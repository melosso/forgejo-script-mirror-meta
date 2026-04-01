<script>
    (function() {
        const enableStars = true;
        const enableForks = true;
        const useAnimation = true;

        const CACHE_KEY_PREFIX = "fjs_cache_v9_";
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        const format = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n;

        const getCache = (key) => {
            try {
                const item = localStorage.getItem(CACHE_KEY_PREFIX + key);
                if (!item) return null;
                const parsed = JSON.parse(item);
                if (Date.now() - parsed.timestamp > ONE_DAY_MS) return null;
                return parsed.data;
            } catch (e) { return null; }
        };

        const setCache = (key, data) => {
            try {
                localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ timestamp: Date.now(), data: data }));
            } catch (e) { }
        };

        const updateValue = (el, target) => {
            let textNode = Array.from(el.childNodes).reverse().find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim() !== "");
            if (!textNode) {
                textNode = document.createTextNode(" 0 ");
                el.appendChild(textNode);
            }

            if (!useAnimation) {
                textNode.nodeValue = " " + format(target) + " ";
                return;
            }

            const start = performance.now();
            const step = (now) => {
                const prog = Math.min((now - start) / 1200, 1);
                const val = Math.floor((1 - Math.pow(1 - prog, 3)) * target);
                textNode.nodeValue = " " + format(val) + " ";
                if (prog < 1) requestAnimationFrame(step);
                else textNode.nodeValue = " " + format(target) + " ";
            };
            requestAnimationFrame(step);
        };

        async function fetchRemoteData(url) {
            const cacheKey = 'remote_' + btoa(url);
            const cached = getCache(cacheKey);
            if (cached !== null) return cached;

            try {
                const u = new URL(url);
                const path = u.pathname.replace(/^\/|\/$/g, '').replace(/\.git$/, '');
                let apiUri = "";
                let parser = (d) => null;

                if (u.hostname.includes('github.com')) {
                    apiUri = `https://api.github.com/repos/${path}`;
                    parser = (d) => ({ stars: d.stargazers_count, forks: d.forks_count });
                } else if (u.hostname.includes('gitlab.com')) {
                    apiUri = `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}`;
                    parser = (d) => ({ stars: d.star_count, forks: d.forks_count });
                } else {
                    apiUri = `${u.origin}/api/v1/repos/${path}`;
                    parser = (d) => ({ 
                        stars: d.stars_count !== undefined ? d.stars_count : d.stargazers_count, 
                        forks: d.forks_count 
                    });
                }

                const r = await fetch(apiUri);
                if (r.ok) {
                    const d = await r.json();
                    const data = parser(d);
                    if (data) {
                        setCache(cacheKey, data);
                        return data;
                    }
                }
            } catch (e) { }
            
            setCache(cacheKey, { stars: 0, forks: 0, unsupported: true });
            return null;
        }

        async function getLocalRepoMeta(localPath) {
            const cached = getCache('meta_' + localPath);
            if (cached !== null) return cached;
            try {
                const r = await fetch('/api/v1/repos' + localPath);
                if (r.ok) {
                    const d = await r.json();
                    const meta = { isMirror: !!d.mirror, url: d.original_url || '' };
                    setCache('meta_' + localPath, meta);
                    return meta;
                }
                if (r.status === 404) {
                    setCache('meta_' + localPath, { isMirror: false, url: '', error: 404 });
                }
            } catch (e) {}
            return { isMirror: false, url: '' };
        }

        async function scanAndSpoof() {
            const query = [];
            if (enableStars) query.push('.star-count', '.web.count', 'a[href$="/stars"]');
            if (enableForks) query.push('a[href$="/forks"]');
            
            if (query.length === 0) return;
            const targets = document.querySelectorAll(query.join(','));

            for (const el of targets) {
                if (el.dataset.spoofed) continue;
                
                const href = el.getAttribute('href');
                if (!href) continue;

                const parts = href.split('/').filter(Boolean);
                if (parts.length < 2 || ['explore', 'org', 'user', 'settings'].includes(parts[0])) {
                    el.dataset.spoofed = "ignored";
                    continue;
                }

                const localPath = '/' + parts[0] + '/' + parts[1];
                el.dataset.spoofed = "pending";

                const meta = await getLocalRepoMeta(localPath);
                
                if (meta.isMirror && meta.url) {
                    const remoteData = await fetchRemoteData(meta.url);
                    if (remoteData && !remoteData.unsupported) {
                        el.dataset.spoofed = "done";
                        updateValue(el, href.endsWith('/forks') ? remoteData.forks : remoteData.stars);
                        continue;
                    }
                }
                el.dataset.spoofed = "skipped";
            }
        }

        const startObserver = () => {
            if (!document.body) {
                window.requestAnimationFrame(startObserver);
                return;
            }
            scanAndSpoof();
            let timeout;
            const observer = new MutationObserver(() => {
                clearTimeout(timeout);
                timeout = setTimeout(scanAndSpoof, 150);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", startObserver);
        } else {
            startObserver();
        }
    })();
</script>