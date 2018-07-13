import React from 'react';

export class MyComponent extends React.Component {
  render() {
    return React.createElement("div", null, this.props.string);
  }
}