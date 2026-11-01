import { getDiscussionHistory } from './history';
import {
  deleteDiscussionReply,
  deleteDiscussionTailReply,
  editDiscussionReply,
  editDiscussionTailReply,
  replyDiscussion,
  replyDiscussionTail,
} from './reply';
import {
  createDiscussion,
  deleteDiscussion,
  reactToDiscussion,
  setDiscussionLock,
  starDiscussion,
  updateDiscussion,
} from './topic';

const Discussion = {
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  setDiscussionLock,
  starDiscussion,
  reactToDiscussion,
  getDiscussionHistory,
  replyDiscussion,
  replyDiscussionTail,
  editDiscussionReply,
  deleteDiscussionReply,
  editDiscussionTailReply,
  deleteDiscussionTailReply,
};

export default Discussion;
