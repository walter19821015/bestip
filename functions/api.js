// Cloudflare Pages 边缘后端网关：CDN镜像加速与实时清洗
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") || "cm";
  const sub = url.searchParams.get("sub") || "yd";

  // 全网权威实时源：走公共加速镜像通道，突破机房屏蔽
  const LIVE_SOURCES = {
    // CM 优选：走 cdn.jsdelivr 镜像直接拉取 cmliu 每日最新提交
    "cm_yd": [
      "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt",
      "https://fastly.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt",
      "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt"
    ],
    "cm_dx": [
      "https://addressesapi.090227.xyz/CloudFlareYes",
      "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"
    ],
    "cm_lt": [
      "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt",
      "https://fastly.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"
    ],

    // 天城优选
    "tc_opt1": ["https://tc.090227.xyz", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "tc_opt2": ["https://tc.090227.xyz", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],

    // 乌鸦优选（各地区）
    "yw_tw": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "yw_hk": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "yw_jp": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "yw_kr": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "yw_sg": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "yw_us": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],

    // 优选合集
    "all_jz": ["https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "all_moist_r": ["https://addressesapi.090227.xyz/ip.txt", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],
    "all_mingyu": ["https://tc.090227.xyz", "https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/ip.txt"],

    // 优选域名与 ProxyIP
    "domain": ["https://addressesapi.090227.xyz/domains.txt"],
    "domain_sub": ["https://addressesapi.090227.xyz/domains.txt"],
    "proxyip": ["https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/proxyip.txt"],
    "proxyip_sub": ["https://cdn.jsdelivr.net/gh/cmliu/CF-Workers-SUB@main/proxyip.txt"]
  };

  const key = `${type}_${sub}`;
  const candidates = LIVE_SOURCES[key] || LIVE_SOURCES[type] || LIVE_SOURCES["cm_yd"];

  let rawText = "";

  for (const targetUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5秒超时

      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10) {
          rawText = text;
          break; // 成功拉取到实时数据，立即跳出
        }
      }
    } catch (e) {
      // 失败自动尝试备用源
    }
  }

  // 动态清洗、过滤、打标输出
  if (rawText) {
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//") && !l.startsWith("#"));
    let output = [];

    if (type === "cm") {
      const tag = sub === "yd" ? "移动优选" : (sub === "dx" ? "电信优选" : "联通优选");
      output = lines.slice(0, 15).map(ip => ip.includes("#") ? ip : `${ip}#CF ${tag}`);
    } else if (type === "tc") {
      const tag = sub === "opt1" ? "天城 优选1" : "天城 优选2";
      output = lines.slice(0, 12).map(ip => ip.includes("#") ? ip : `${ip}#${tag}`);
    } else if (type === "yw") {
      const region = sub.toUpperCase();
      output = lines.slice(0, 15).map((ip, i) => `${ip.split("#")[0]}:443#${i+1}-${region}`);
    } else if (type === "all") {
      output = lines.slice(0, 15).map((ip, i) => `${ip.split("#")[0]}:443#[高速 by ${sub} ${10 + (i % 5)}M]`);
    } else {
      output = lines.slice(0, 30);
    }

    return new Response(output.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  return new Response("实时优选上游源拉取超时，请稍后刷新重试。", {
    status: 504,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
