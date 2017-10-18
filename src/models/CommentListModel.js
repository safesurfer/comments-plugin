import { observable, action } from 'mobx';
import SafeApi from '../safe_api';
import CONSTANTS from '../constants';

import CommentModel from './CommentModel';

export default class CommentListModel {
  @observable comments = [];

  @observable isLoading = false;

  @observable publicNames = [];

  @observable isOwner = false;

  @observable isNwConnected = true;

  @observable isNwConnecting = false;

  @action
  nwStateCb = (newState) => {
    console.log("@model Network state changed to: ", newState);
    if (newState === CONSTANTS.NET_STATE.CONNECTED) {
      this.isNwConnected = true;
      return;
    }
    this.isNwConnected = false;
  }

  @action
  authorise = async (topic) => {
    try {
      this.api = new SafeApi(topic, this.nwStateCb);
      await this.api.authorise(topic);
      this.comments = await this.api.listComments();
      const publicIDList = await this.api.getPublicNames();
      this.publicNames = publicIDList;
      this.isOwner = await this.api.isOwner();
    } catch (err) {
      alert(`Failed to initialise: ${err}`);
    }
  }

  @action
  addComment = async (name, message) => {
    try {
      this.isLoading = true;
      const date = new Date().toUTCString();
      this.comments = await this.api.postComment(new CommentModel(name, message, date));
      this.isLoading = false;
    } catch (err) {
      console.error('addComment: ', err);
      this.isLoading = false;
    }
  }

  @action
  deleteComment = async (comment) => {
    try {
      this.isLoading = true;
      this.comments = await this.api.deleteComment(comment);
      this.isLoading = false;
    } catch (err) {
      console.error('deleteComment: ', err);
      this.isLoading = false;
    }
  }

  @action
  reconnect = async () => {
    try {
      this.isNwConnecting = true;
      await this.api.reconnect();
      this.isNwConnecting = false;
      this.isNwConnected = true;
    } catch (err) {
      console.error('reconnect error :: ', err);
      this.isNwConnected = false;
    }
  }
}