import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  // Same origin — /api/* routes to Express in both dev (Vite proxy) and production (Vercel rewrite)
  baseURL: '/api/v1',
  withCredentials: true,
});

// Attach bearer token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let refreshing = false;
let refreshQueue: Array<(token: string) => void> = [];


api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (refreshing) {
        return new Promise((resolve) =>
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          })
        );
      }

      refreshing = true;
      try {
        const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = res.data.data;
        useAuthStore.getState().setToken(accessToken);
        refreshQueue.forEach((cb) => cb(accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Opens an authenticated HTML endpoint (such as a thermal receipt, invoice, or debit note)
 * in a new window or prints via a hidden iframe, passing the Bearer token via axios interceptor.
 * This completely resolves the 401 Unauthorized bug caused by raw window.open().
 */
export async function openAuthedHtml(
  endpoint: string,
  options?: { title?: string; autoPrint?: boolean }
): Promise<void> {
  const res = await api.get(endpoint, { responseType: 'text' });
  let html = res.data;

  if (options?.autoPrint ?? true) {
    if (!html.includes('window.print()')) {
      const printScript = `
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 250);
  });
</script>
`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', printScript + '</body>');
      } else {
        html += printScript;
      }
    }
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(
    blobUrl,
    '_blank',
    'width=440,height=650,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes'
  );

  if (printWindow) {
    printWindow.addEventListener('unload', () => {
      URL.revokeObjectURL(blobUrl);
    });
    // Fallback revocation after 60 seconds
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else {
    // If popups are blocked by browser policy, fallback to hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(blobUrl);
          }, 30000);
        }
      }, 250);
    };
  }
}
