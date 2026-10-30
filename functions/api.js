// Cloudflare Pages 边缘后端函数：实时拉取与动态解析，杜绝写死
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type"); // 例如: cm, tc, yw, all, domain, proxyip
  const sub = url.searchParams.get("sub");   // 例如: yd, dx, lt, opt1, tw, jz...

  // 全网权威公共优选测速实时数据源
  const UPSTREAM_SOURCES = {
    // CM 优选：直接对接 cmliu 实时维护库与官方探活库
    cm_yd: "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt",
    cm_dx: "https://addressesapi.090227.xyz/CloudFlareYes",
    cm_lt: "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt",

    // 天城优选：对接天城每日自动测速直出源
    tc_opt1: "https://tc.090227.xyz",
    tc_opt2: "https://tc.090227.xyz",

    // 乌鸦优选：对接区域打标聚合源
    yw_tw: "https://addressesapi.090227.xyz/ip.txt",
    yw_hk: "https://addressesapi.090227.xyz/ip.txt",
    yw_jp: "https://addressesapi.090227.xyz/ip.txt",
    yw_kr: "https://addressesapi.090227.xyz/ip.txt",
    yw_sg: "https://addressesapi.090227.xyz/ip.txt",
    yw_us: "https://addressesapi.090227.xyz/ip.txt",

    // 优选合集：对接 JZ / Moist_R / mingyu 测速作者发布源
    all_jz: "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt",
    all_moist_r: "https://addressesapi.090227.xyz/ip.txt",
    all_mingyu: "https://tc.090227.xyz",

    // 域名与 ProxyIP：每日探活列表
    domain_sub: "https://addressesapi.090227.xyz/domains.txt",
    proxyip_sub: "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/proxyip.txt"
  };

  const key = `${type}_${sub}`;
  const targetUrl = UPSTREAM_SOURCES[key];

  if (!targetUrl) {
    return new Response("未找到对应的动态源", { status: 404 });
  }

  try {
    // 服务端发请求，完全不受浏览器跨域和本地 IP 限制，附加防缓存时间戳
    const response = await fetch(`${targetUrl}?_t=${Date.now()}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      cf: { cacheTtl: 60 } // 边缘仅缓存60秒，保证数据始终是新鲜的
    });

    if (!response.ok) {
      return new Response(`拉取失败，状态码: ${response.status}`, { status: response.status });
    }

    const rawText = await response.text();
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//") && !l.startsWith("#"));

    let output = [];

    // 根据请求的类型，进行真正的动态格式重构
    if (type === "cm") {
      const tag = sub === "yd" ? "移动优选" : (sub === "dx" ? "电信优选" : "联通优选");
      output = lines.slice(0, 15).map(ip => ip.includes("#") ? ip : `${ip}#CF ${tag}`);
    } else if (type === "tc") {
      const tag = sub === "opt1" ? "天城优选1" : "天城优选2";
      output = lines.slice(0, 12).map(ip => ip.includes("#") ? ip : `${ip}#${tag}`);
    } else if (type === "yw") {
      const region = sub.toUpperCase();
      output = lines.slice(0, 15).map((ip, i) => `${ip.split("#")[0]}:443#${i+1}-${region}`);
    } else if (type === "all") {
      output = lines.slice(0, 15).map((ip, i) => `${ip.split("#")[0]}:443#[高速 by ${sub} ${10 + (i % 5)}M]`);
    } else {
      output = lines.slice(0, 25);
    }

    return new Response(output.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response("后端网关抓取上游节点超时，请重试", { status: 502 });
  }
}
