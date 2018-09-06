from __future__ import absolute_import
from datetime import datetime

from sentry import analytics, features
from sentry.models import (
    ExternalIssue, Group, GroupLink, GroupStatus, Integration, Organization, OrganizationIntegration, User
)
from sentry.integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name='sentry.tasks.integrations.post_comment',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
# TODO(jess): Add more retry exclusions once ApiClients have better error handling
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def post_comment(external_issue_id, data, **kwargs):
    # sync Sentry comments to an external issue
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has('organizations:integrations-issue-sync',
                                  organization)
    if not has_issue_sync:
        return

    integration = Integration.objects.get(id=external_issue.integration_id)
    installation = integration.get_installation(
        organization_id=external_issue.organization_id,
    )
    if installation.should_sync('comment'):
        installation.create_comment(
            external_issue.key, data['text'])
        analytics.record(
            'integration.issue.comments.synced',
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )


@instrumented_task(
    name='sentry.tasks.integrations.jira.sync_metadata',
    queue='integrations',
    default_retry_delay=20,
    max_retries=5
)
@retry(on=(IntegrationError,), exclude=(Integration.DoesNotExist,))
def sync_metadata(integration_id, **kwargs):
    integration = Integration.objects.get(id=integration_id)
    installation = integration.get_installation(None)
    installation.sync_metadata()


@instrumented_task(
    name='sentry.tasks.integrations.sync_assignee_outbound',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist,
                User.DoesNotExist, Organization.DoesNotExist))
def sync_assignee_outbound(external_issue_id, user_id, assign, **kwargs):
    # sync Sentry assignee to an external issue
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has('organizations:integrations-issue-sync',
                                  organization)

    if not has_issue_sync:
        return

    integration = Integration.objects.get(id=external_issue.integration_id)
    # assume unassign if None
    if user_id is None:
        user = None
    else:
        user = User.objects.get(id=user_id)

    installation = integration.get_installation(
        organization_id=external_issue.organization_id,
    )
    if installation.should_sync('outbound_assignee'):
        installation.sync_assignee_outbound(external_issue, user, assign=assign)
        analytics.record(
            'integration.issue.assignee.synced',
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )


@instrumented_task(
    name='sentry.tasks.integrations.sync_status_outbound',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def sync_status_outbound(group_id, external_issue_id, **kwargs):
    try:
        group = Group.objects.filter(
            id=group_id,
            status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED],
        )[0]
    except IndexError:
        return

    has_issue_sync = features.has('organizations:integrations-issue-sync',
                                  group.organization)
    if not has_issue_sync:
        return

    external_issue = ExternalIssue.objects.get(id=external_issue_id)
    integration = Integration.objects.get(id=external_issue.integration_id)
    installation = integration.get_installation(
        organization_id=external_issue.organization_id,
    )
    if installation.should_sync('outbound_status'):
        installation.sync_status_outbound(
            external_issue, group.status == GroupStatus.RESOLVED, group.project_id
        )
        analytics.record(
            'integration.issue.status.synced',
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )


@instrumented_task(
    name='sentry.tasks.integrations.kick_off_status_syncs',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry()
def kick_off_status_syncs(project_id, group_id, **kwargs):
    # doing this in a task since this has to go in the event manager
    # and didn't want to introduce additional queries there
    external_issue_ids = GroupLink.objects.filter(
        project_id=project_id,
        group_id=group_id,
        linked_type=GroupLink.LinkedType.issue,
    ).values_list('linked_id', flat=True)

    for external_issue_id in external_issue_ids:
        sync_status_outbound.apply_async(
            kwargs={
                'group_id': group_id,
                'external_issue_id': external_issue_id,
            }
        )


@instrumented_task(
    name='sentry.tasks.integrations.kickoff_vsts_subscription_check',
    queue='integrations',
    default_retry_delay=60 * 5,  # TODO(lb): not sure what this should be
    max_retries=5,
)
@retry()
def kickoff_vsts_subscription_check():
    all_integrations = Integration.objects.filter(
        provider='vsts',
    )
    subscription_check_interval = None  # RAWR
    integrations_to_check = []
    for integration in all_integrations:
        try:
            subscription = integration.metadata['subscription']
        except KeyError:
            continue
        try:
            if subscription['check'] <= subscription_check_interval:  # 6 hours?
                integrations_to_check.append(integration)
        except KeyError:
            integrations_to_check.append(integration)

    for integration in integrations_to_check:
        organization_ids = OrganizationIntegration.objects.filter(
            integration_id=integration.id,
        ).values_list('organization_id', flatten=True)
        for organization_id in organization_ids:
            vsts_subscription_check(integration, organization_id).apply_async(
                kwargs={
                    'integration': integration,
                    'organization_id': organization_id,
                }
            )


@instrumented_task(
    name='sentry.tasks.integrations.vsts_subscription_check',
    queue='integrations',
    default_retry_delay=60 * 5,  # TODO(lb): not sure what this should be
    max_retries=5,
)
@retry(exclude=(ApiError, ApiUnauthorized))
def vsts_subscription_check(integration, organization_id, **kwargs):
    installation = integration.get_installation(organization_id=organization_id)
    client = installation.get_client()
    subscription_id = integration.metadata['subscription']['id']
    subscription = client.get_subscription(
        instance=installation.instance,
        subscription_id=subscription_id,
    )

    # TODO(lb): looked at 'onProbation' status cannot tell how/if it affects functionality
    # https://docs.microsoft.com/en-us/rest/api/vsts/hooks/subscriptions/replace%20subscription?view=vsts-rest-4.1#subscriptionstatus
    if subscription['status'] == 'disabledBySystem':
        client.update_subscription(
            instance=installation.instance,
            subscription_id=subscription_id,
        )
        integration.metadata['subscription']['check'] = datetime.now()
        integration.save()
