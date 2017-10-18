import { observable } from 'mobx';

class CommentModel {
  id = Math.random();

  @observable title;

  constructor(name, message, date) {
    this.name = name;
    this.date = date;
    this.message = message;
  }
}

export default CommentModel;
