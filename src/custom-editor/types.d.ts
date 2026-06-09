
import type {
    AxiosError,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';

type RequestConfig = InternalAxiosRequestConfig & { id: string };
type Response = AxiosResponse & { config: RequestConfig };
export type RequestError = AxiosError & { response: Response };

export interface APIError {
    message: string;
    extensions: {
        code: string;
        [key: string]: any;
    };
}