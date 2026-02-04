import Toast from 'react-native-toast-message';

export const toastError = (msg) =>
    Toast.show({
        type: 'error',
        text1: msg,
    });

export const toastSuccess = (msg) =>
    Toast.show({
        type: 'success',
        text1: msg,
    });
