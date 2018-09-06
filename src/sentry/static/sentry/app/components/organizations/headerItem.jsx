import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import space from 'app/styles/space';

class HeaderItem extends React.Component {
  static propTypes = {
    label: PropTypes.node,
    align: PropTypes.oneOf(['right', 'left']),

    /**
     * className for <Label> component
     */
    labelClassName: PropTypes.string,
    margin: PropTypes.string,
  };

  static defaultProps = {
    align: 'right',
    margin: space(1),
  };

  render() {
    const {className, labelClassName, label, align, children, margin} = this.props;

    return (
      <StyledHeaderItem align={align} className={className}>
        <Label className={labelClassName} margin={margin}>
          {label}
        </Label>
        {children}
      </StyledHeaderItem>
    );
  }
}

export default HeaderItem;

const StyledHeaderItem = styled(props => (
  <Flex direction="column" justify="center" {...props} />
))`
  text-align: ${p => p.align};

  .dropdown-actor-title {
    font-size: 15px;
    height: auto;
    color: ${p => p.theme.button.default.colorActive};
  }
`;

const Label = styled('label')`
  font-weight: 400;
  font-size: 13px;
  color: ${p => p.theme.gray6};
  margin-bottom: ${p => p.margin};
`;
