import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import Count from 'app/components/count';
import IdBadge from 'app/components/idBadge';
import PercentageBarChart from 'app/components/charts/percentageBarChart';
import PieChart from 'app/components/charts/pieChart';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import Header from './styles/header';
import HealthPanelChart from './styles/healthPanelChart';
import HealthRequest from './util/healthRequest';
import HealthTableChart from './styles/healthTableChart';
import withHealth from './util/withHealth';

const ReleasesRequest = withApi(
  class ReleasesRequestComponent extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        data: null,
      };
    }

    async componentDidMount() {
      // fetch releases
      let {api, organization, limit} = this.props;
      if (!organization) return;

      try {
        const releases = await api.requestPromise(
          `/organizations/${organization.slug}/releases/`,
          {
            query: {
              per_page: limit,
            },
          }
        );

        // eslint-disable-next-line
        this.setState({
          data: releases,
        });
      } catch (err) {
        addErrorMessage(t('Unable to fetch releases'));
      }
    }

    render() {
      let {children, ...props} = this.props;
      let {data} = this.state;
      let loading = data === null;

      if (!data) {
        return null;
        return children({
          loading,
          data,
        });
      }

      return (
        <HealthRequest
          tag="release"
          includeTimeseries
          interval="1d"
          showLoading
          limit={10}
          getCategory={({shortVersion}) => shortVersion}
          specifiers={data.map(({version}) => `release:${version}`)}
          {...props}
        >
          {children}
        </HealthRequest>
      );
    }
  }
);

class OrganizationHealthErrors extends React.Component {
  static propTypes = {
    actions: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  handleSetFilter = (tag, value) => {
    this.props.actions.setFilter(tag, value);
  };

  render() {
    let {organization, className} = this.props;
    return (
      <div className={className}>
        <Flex justify="space-between">
          <Header>
            {t('Errors')}
            <SubduedCount>
              (<Count value={12198} />)
            </SubduedCount>
          </Header>
        </Flex>

        <Flex>
          <HealthRequest
            tag="error.handled"
            includeTimeseries
            interval="1d"
            showLoading
            getCategory={value => (value ? 'Handled' : 'Crash')}
          >
            {({timeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Errors')}
                  series={timeseriesData}
                >
                  {props => <AreaChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>

          <HealthRequest tag="user" showLoading includeTop includeTimeseries={false}>
            {({originalTagData: originalData, tag}) => (
              <HealthTableChart
                headers={[t('Most Impacted')]}
                data={originalData.map(row => [row, row])}
                widths={[null, 120]}
                getValue={item => (typeof item === 'number' ? item : item && item.count)}
                renderHeaderCell={({getValue, value, columnIndex}) => {
                  return typeof value === 'string' ? (
                    value
                  ) : (
                    <div onClick={() => this.handleSetFilter(tag, value[tag]._health_id)}>
                      <IdBadge
                        user={value[tag].value}
                        displayName={
                          value[tag] && value[tag].value && value[tag].value.label
                        }
                      />
                    </div>
                  );
                }}
                renderDataCell={({getValue, value, columnIndex}) => {
                  return <Count value={getValue(value)} />;
                }}
                showRowTotal={false}
                showColumnTotal={false}
                shadeRowPercentage
              />
            )}
          </HealthRequest>
        </Flex>

        <Flex>
          <ReleasesRequest organization={organization}>
            {({timeseriesData}) => {
              console.log('percentagebarchart', timeseriesData);
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Releases')}
                  series={timeseriesData}
                >
                  {props => <PercentageBarChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </ReleasesRequest>

          <ReleasesRequest organization={organization}>
            {({timeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Releases')}
                  series={timeseriesData}
                >
                  {props => <AreaChart {...props} />}
                </HealthPanelChart>
              );
            }}
          </ReleasesRequest>
        </Flex>
        <Flex>
          <HealthRequest
            tag="error.type"
            showLoading
            includeTimeseries={false}
            includeTop
            interval="1d"
          >
            {({tagData}) => {
              return (
                <HealthTableChart
                  title="Error Type"
                  headers={['Error type']}
                  data={tagData}
                  widths={[null, 60, 60, 60, 60]}
                  showColumnTotal
                  shadeRowPercentage
                />
              );
            }}
          </HealthRequest>
        </Flex>

        <Flex>
          <HealthRequest
            tag="release"
            showLoading
            includeTimeseries={false}
            includeTop
            limit={5}
            topk={5}
            getCategory={({shortVersion}) => shortVersion}
          >
            {({originalTagData: data, tag}) => {
              return (
                <React.Fragment>
                  <HealthTableChart
                    headers={[t('Errors by Release')]}
                    data={data.map(row => [row, row])}
                    widths={[null, 120]}
                    getValue={item =>
                      typeof item === 'number' ? item : item && item.count}
                    renderHeaderCell={({getValue, value, columnIndex}) => {
                      return (
                        <Flex justify="space-between">
                          <ReleaseName
                            onClick={() =>
                              this.handleSetFilter(tag, value[tag]._health_id)}
                          >
                            {value[tag].value.shortVersion}
                          </ReleaseName>
                          <Project>
                            {value.topProjects.map(p => (
                              <IdBadge key={p.slug} project={p} />
                            ))}
                          </Project>
                        </Flex>
                      );
                    }}
                    renderDataCell={({getValue, value, columnIndex}) => {
                      return <Count value={getValue(value)} />;
                    }}
                    showRowTotal={false}
                    showColumnTotal={false}
                    shadeRowPercentage
                  />
                  <HealthPanelChart
                    height={300}
                    title={t('Errors By Release')}
                    showLegend={false}
                    series={[
                      {
                        seriesName: t('Errors By Release'),
                        data: data.map(row => ({
                          name: row.release.value.shortVersion,
                          value: row.count,
                        })),
                      },
                    ]}
                  >
                    {({series}) => (
                      <Flex>
                        <PieChartWrapper>
                          <PieChart height={300} series={series} />
                        </PieChartWrapper>
                      </Flex>
                    )}
                  </HealthPanelChart>
                </React.Fragment>
              );
            }}
          </HealthRequest>
        </Flex>
      </div>
    );
  }
}

const PieChartWrapper = styled(Box)`
  flex: 1;
  flex-shrink: 0;
`;

export default withHealth(OrganizationHealthErrors);
export {OrganizationHealthErrors};

const SubduedCount = styled('span')`
  color: ${p => p.theme.gray1};
  margin-left: ${space(0.5)};
`;

const ReleaseName = styled(Box)`
  ${overflowEllipsis};
`;

const Project = styled(Box)`
  margin-left: ${space(1)};
  flex-shrink: 0;
`;
