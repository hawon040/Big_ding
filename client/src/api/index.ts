import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// 이미지/아바타 등 업로드 파일이 실제로 위치한 서버 origin (baseURL에서 "/api"를 뗀 부분).
// 서버가 절대 URL(예: http://localhost:5000/...)로 내려주더라도, 그 호스트가 지금 이 브라우저
// 기준으로는 접근 불가능할 수 있으므로(다른 PC/네트워크에서 접속한 경우) 경로만 취해서
// 지금 클라이언트가 실제로 API를 호출하는 origin으로 다시 조합해 보여준다.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export const resolveAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return `${API_ORIGIN}${url}`;
  try {
    return `${API_ORIGIN}${new URL(url).pathname}`;
  } catch {
    return url;
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 요청마다 JWT 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 응답 시 자동 로그아웃
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
