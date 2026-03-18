const permission = { granted: false, canAskAgain: true };

const CameraView = () => null;
const getCameraPermissionsAsync = async () => permission;
const requestCameraPermissionsAsync = async () => permission;
const useCameraPermissions = () => [
  permission,
  requestCameraPermissionsAsync,
  getCameraPermissionsAsync,
];

const Camera = {
  getCameraPermissionsAsync,
  requestCameraPermissionsAsync,
};

export {
  Camera,
  CameraView,
  getCameraPermissionsAsync,
  requestCameraPermissionsAsync,
  useCameraPermissions,
};
