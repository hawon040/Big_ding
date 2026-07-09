import axios from "axios";

// .env에 박혀있는 값(보통 http://localhost:5000/api)을 그대로 쓰면, 개발자 본인 PC에서만
// 정상 동작하고 다른 사람의 휴대폰/PC에서 접속했을 때는 "localhost"가 그 사람 자신의 기기를
// 가리키게 되어 API/이미지 요청이 전부 실패한다(= 사진이 "첨부 이미지"로 깨지는 원인).
// 그래서 .env의 호스트가 localhost/127.0.0.1인데 실제로는 그게 아닌 다른 주소(같은 네트워크의
// IP나 배포 도메인)로 접속한 상태라면, 지금 브라우저 주소창의 호스트를 그대로 가져와 쓰도록
// 자동으로 보정한다. .env에 실제 배포 도메인을 정확히 넣어둔 경우에는 이 보정이 아무 영향도
// 주지 않는다(조건에 해당하지 않으므로 원래 값 그대로 사용됨).
const resolveEnvHost = (raw: string): string => {
  try {
    const configured = new URL(raw);
    const isLocalhostConfigured = ["localhost", "127.0.0.1"].includes(configured.hostname);
    const isBrowserOnLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalhostConfigured && !isBrowserOnLocalhost) {
      // 포트/프로토콜은 .env에 설정된 값을 유지하고, 호스트만 지금 접속 중인 주소로 교체한다.
      configured.hostname = window.location.hostname;
      configured.protocol = window.location.protocol; // https 페이지에서 http 이미지가 막히는 문제 방지
      return configured.toString().replace(/\/$/, "");
    }
    return raw.replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
};

const API_BASE_URL = resolveEnvHost(import.meta.env.VITE_API_URL || "http://localhost:5000/api");

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
