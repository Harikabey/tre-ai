const unsupportedFileSystemOperation = (): never => {
  throw new Error('Sherpa ONNX Expo file operations are not available in the browser');
};

export const documentDirectory = '/';
export const getInfoAsync = unsupportedFileSystemOperation;
export const makeDirectoryAsync = unsupportedFileSystemOperation;
export const createDownloadResumable = unsupportedFileSystemOperation;
export const deleteAsync = unsupportedFileSystemOperation;
