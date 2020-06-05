import { ImportResolver } from '../src';
import path from 'path';

// https://github.com/googleapis/googleapis/blob/50af0530730348f1e3697bf3c70261f7daaf2981/google/api/metric.proto
const GOOGLE_APIS_REPO = 'googleapis/googleapis';
const GOOGLE_APIS_COMMIT = '50af0530730348f1e3697bf3c70261f7daaf2981';
const METRIC = 'google/api/metric.proto';
const LABEL = 'google/api/label.proto';
const LAUNCH_STAGE = 'google/api/launch_stage.proto';

// https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/duration.proto
const GOOGLE_PROTOBUF_REPO = 'protocolbuffers/protobuf';
const GOOGLE_PROTOBUF_COMMIT = '176f7db11d8242b36a3ea6abb1cc436fca5bf75d';
const DURATION = 'google/protobuf/duration.proto';

export const protoFiles = { METRIC, LABEL, LAUNCH_STAGE, DURATION };

const fixtures = ['sample.proto', 'no-package.proto'];

export const importResolverForTesting: ImportResolver = (target) => {
  if (fixtures.includes(target)) {
    return ['read-file', path.resolve(__dirname, '../src/__fixtures__/', target)];
  } else if (target.startsWith('google/api/')) {
    return ['github-contents', GOOGLE_APIS_REPO, target, GOOGLE_APIS_COMMIT];
  } else if (target.startsWith('google/protobuf/')) {
    return ['github-contents', GOOGLE_PROTOBUF_REPO, `src/${target}`, GOOGLE_PROTOBUF_COMMIT];
  }
  return null;
};
