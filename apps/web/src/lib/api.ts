const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ApiError = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

export class ApiException extends Error {
  status: number;
  data: ApiError;

  constructor(status: number, data: ApiError) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiException(res.status, data as ApiError);
  }

  return data as T;
}
