import React from 'react';
import {mount} from 'enzyme';

import {OrganizationHealthErrors} from 'app/views/organizationHealth/errors';

jest.mock('app/utils/withLatestContext');
jest.mock('echarts-for-react/lib/core', () => jest.fn(() => null));

describe('OrganizationHealthErrors', function() {
  const org = TestStubs.Organization();
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/top/',
    body: (url, opts) => {
      return TestStubs.HealthTop(opts.query.tag);
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/graph/',
    body: (url, opts) => {
      return TestStubs.HealthGraph(opts.query.tag);
    },
  });

  it('renders', function() {
    mount(<OrganizationHealthErrors organization={org} />, TestStubs.routerContext());
  });
});
