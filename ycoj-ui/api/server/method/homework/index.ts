import { getHomeworkDetail } from './detail';
import { getHomeworkFiles } from './files';
import { getHomeworkList } from './list';
import { getHomeworkScoreboard } from './scoreboard';
import { getHomeworkEdit } from '@/api/server/method/homework/edit';

const Homework = {
  getHomeworkList,
  getHomeworkDetail,
  getHomeworkEdit,
  getHomeworkScoreboard,
  getHomeworkFiles,
};

export default Homework;
