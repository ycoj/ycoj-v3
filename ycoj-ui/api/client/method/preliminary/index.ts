import { deletePreliminary } from '@/api/client/method/preliminary/delete';
import {
  importObjectiveProblem,
  searchObjectiveProblems,
} from '@/api/client/method/preliminary/import';
import { savePreliminary } from '@/api/client/method/preliminary/save';
import { submitPreliminary } from '@/api/client/method/preliminary/submit';

const Preliminary = {
  importObjectiveProblem,
  searchObjectiveProblems,
  submitPreliminary,
  savePreliminary,
  deletePreliminary,
};

export default Preliminary;
