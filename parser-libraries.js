/* Load only the parser needed by the selected file. No document work on startup. */
(() => {
  'use strict';
  const libraries = {
    XLSX: ['Excel', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'],
    JSZip: ['압축 문서', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'],
    mammoth: ['Word', 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'],
    pdfjsLib: ['PDF', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],
  };
  const pending = new Map();
  window.ReqlyParserLibraries = {
    load(name) {
      if (!Object.hasOwn(libraries, name)) return Promise.reject(new Error('지원하지 않는 문서 도구입니다.'));
      if (window[name]) return Promise.resolve(window[name]);
      if (pending.has(name)) return pending.get(name);
      const [label, url] = libraries[name];
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        let finished = false;
        const finish = error => {
          if (finished) return;finished = true;clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) { script.remove();reject(error); } else resolve(window[name]);
        };
        const failure = () => new Error(`${label} 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`);
        const timer = setTimeout(() => finish(failure()), 30000);
        script.src = url;script.async = true;
        script.onload = () => finish(window[name] ? null : failure());
        script.onerror = () => finish(failure());
        document.head.append(script);
      });
      pending.set(name, promise);
      promise.catch(() => { if (pending.get(name) === promise) pending.delete(name); });
      return promise;
    },
  };
})();
