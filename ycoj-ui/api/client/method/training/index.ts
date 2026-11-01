import { createTraining } from '@/api/client/method/training/create';
import { deleteTraining } from '@/api/client/method/training/delete';
import { editTraining } from '@/api/client/method/training/edit';
import { enrollTraining } from '@/api/client/method/training/enroll';
import {
  deleteTrainingFiles,
  getTrainingFileUrl,
  resolveTrainingFileUrl,
  uploadTrainingFile,
} from '@/api/client/method/training/files';

const Training = {
  createTraining,
  deleteTraining,
  editTraining,
  enrollTraining,
  uploadTrainingFile,
  deleteTrainingFiles,
  getTrainingFileUrl,
  resolveTrainingFileUrl,
};

export default Training;
