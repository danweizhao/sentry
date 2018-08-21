import React from 'react';
import {mount} from 'enzyme';

import {OrganizationHealthErrors} from 'app/views/organizationHealth/errors';

describe('OrganizationHealthErrors', function() {
  it('renders', function() {
    let wrapper = mount(
      <OrganizationHealthErrors organization={TestStubs.Organization()} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
