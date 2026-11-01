import { createHomework } from './create';
import { attendHomework } from './registration';
import {
  deleteHomework,
  editHomework,
} from '@/api/client/method/homework/edit';
import {
  deleteHomeworkFiles,
  getHomeworkFileUrl,
  resolveHomeworkFileUrl,
  uploadHomeworkFile,
} from '@/api/client/method/homework/files';

const Homework = {
  createHomework,
  editHomework,
  deleteHomework,
  attendHomework,
  uploadHomeworkFile,
  deleteHomeworkFiles,
  getHomeworkFileUrl,
  resolveHomeworkFileUrl,
};

export default Homework;
