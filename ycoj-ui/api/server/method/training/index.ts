import { getTrainingDetail } from '@/api/server/method/training/detail';
import { getTrainingEdit } from '@/api/server/method/training/edit';
import { getTrainingFiles } from '@/api/server/method/training/files';
import { getTrainingList } from '@/api/server/method/training/list';

const Training = {
  getTrainingDetail,
  getTrainingEdit,
  getTrainingList,
  getTrainingFiles,
};

export default Training;
