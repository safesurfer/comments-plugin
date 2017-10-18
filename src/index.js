import React from 'react';
import { render } from 'react-dom';
import constants from './constants';
import CommentList from './components/CommentList';
import CommentListModel from './models/CommentListModel';

import './style/style.css';

const store = new CommentListModel();

const renderApp = (topic, id) => {
  if (!topic) {
    alert('Topic parameter is missing');
    return;
  }
  render(
    <div>
      <CommentList store={store} topic={topic} />
    </div>,
    document.getElementById(id || constants.DEFAULT_ID),
  );
};

window.safeComments = renderApp;
