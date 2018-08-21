import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {TableChart} from 'app/components/charts/tableChart';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';
import AreaChart from 'app/components/charts/areaChart';
import Count from 'app/components/count';
import PercentageBarChart from 'app/components/charts/percentageBarChart';
import IdBadge from 'app/components/idBadge';
import PanelChart from 'app/components/charts/panelChart';
import PieChart from 'app/components/charts/pieChart';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

import HealthContext from './util/healthContext';
import HealthRequest from './util/healthRequest';

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
      let {children} = this.props;
      let {data} = this.state;
      let loading = data === null;

      if (!data) {
        return children({
          loading,
          data,
        });
      }

      return (
        <HealthRequest
          tag="release"
          timeseries={true}
          interval="1d"
          getCategory={({shortVersion}) => shortVersion}
          filters={data.map(({version}) => `release:${version}`)}
        >
          {children}
        </HealthRequest>
      );
    }
  }
);

const OrganizationHealthErrors = styled(
  class OrganizationHealthErrorsComponent extends React.Component {
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
              Errors
              <SubduedCount>
                (<Count value={12198} />)
              </SubduedCount>
            </Header>
          </Flex>

          <Flex>
            <HealthRequest
              tag="error.handled"
              timeseries={true}
              interval="1d"
              getCategory={value => (value ? 'Handled' : 'Crash')}
            >
              {({data, loading}) => {
                if (!data) return null;
                return (
                  <StyledPanelChart height={200} title={t('Errors')} series={data}>
                    {props => <AreaChart {...props} />}
                  </StyledPanelChart>
                );
              }}
            </HealthRequest>

            <HealthRequest tag="user" timeseries={false}>
              {({originalData, loading, tag}) => (
                <React.Fragment>
                  {!loading && (
                    <StyledTableChart
                      headers={[t('Most Impacted')]}
                      data={originalData.map(row => [row, row])}
                      widths={[null, 120]}
                      getValue={item =>
                        typeof item === 'number' ? item : item && item.count}
                      renderHeaderCell={({getValue, value, columnIndex}) => {
                        return typeof value === 'string' ? (
                          value
                        ) : (
                          <div
                            onClick={() =>
                              this.handleSetFilter(tag, value[tag]._health_id)}
                          >
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
                </React.Fragment>
              )}
            </HealthRequest>
          </Flex>

          <Flex>
            <ReleasesRequest limit={10} organization={organization}>
              {({data, loading}) => {
                if (!data) return null;
                return (
                  <StyledPanelChart height={200} title={t('Releases')} series={data}>
                    {props => <PercentageBarChart {...props} />}
                  </StyledPanelChart>
                );
              }}
            </ReleasesRequest>

            <ReleasesRequest limit={10} organization={organization}>
              {({data, loading}) => {
                if (!data) return null;
                return (
                  <StyledPanelChart height={200} title={t('Releases')} series={data}>
                    {props => <AreaChart {...props} />}
                  </StyledPanelChart>
                );
              }}
            </ReleasesRequest>
          </Flex>
          <Flex>
            <HealthRequest tag="error.type" timeseries={false} interval="1d">
              {({data, loading}) => {
                if (!data) return null;
                return (
                  <StyledTableChart
                    title="Error Type"
                    headers={['Error type']}
                    data={data}
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
              timeseries={false}
              topk={5}
              getCategory={({shortVersion}) => shortVersion}
            >
              {({originalData: data, loading, tag}) => {
                return (
                  <React.Fragment>
                    {!loading && (
                      <React.Fragment>
                        <StyledTableChart
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
                        <StyledPanelChart
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
                        </StyledPanelChart>
                      </React.Fragment>
                    )}
                  </React.Fragment>
                );
              }}
            </HealthRequest>
          </Flex>
        </div>
      );
    }
  }
)``;

const PieChartWrapper = styled(Box)`
  flex: 1;
  flex-shrink: 0;
`;
class OrganizationHealthErrorsContainer extends React.Component {
  render() {
    // Destructure props from `withLatestContext`
    let {
      organizations, // eslint-disable-line
      project, // eslint-disable-line
      lastRoute, // eslint-disable-line
      ...props
    } = this.props;

    return (
      <HealthContext.Consumer>
        {({projects, environments, period, actions}) => (
          <OrganizationHealthErrors
            projects={projects}
            environments={environments}
            period={period}
            actions={actions}
            {...props}
          />
        )}
      </HealthContext.Consumer>
    );
  }
}

export default withApi(withLatestContext(OrganizationHealthErrorsContainer));
export {OrganizationHealthErrors};

const Header = styled(Flex)`
  font-size: 18px;
  margin-bottom: ${space(2)};
`;

const SubduedCount = styled('span')`
  color: ${p => p.theme.gray1};
  margin-left: ${space(0.5)};
`;

const getChartMargin = () => `
  margin-right: ${space(2)};
  &:last-child {
    margin-right: 0;
  }
`;

const StyledPanelChart = styled(PanelChart)`
  ${getChartMargin};
  flex-shrink: 0;
  overflow: hidden;
`;

const StyledTableChart = styled(TableChart)`
  ${getChartMargin};
  flex-shrink: 0;
  overflow: hidden;
`;

const ReleaseName = styled(Box)`
  ${overflowEllipsis};
`;

const Project = styled(Box)`
  margin-left: ${space(1)};
  flex-shrink: 0;
`;
