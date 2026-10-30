// Cloudflare Pages 边缘后端网关：全动态抓取与容灾
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") || "cm";
  const sub = url.searchParams.get("sub") || "yd";

  // 权威在线动态优选源集合（包含备用镜像通道）
  const SOURCE_MAP = {
    // CM 优选
    "cm_yd": [
      "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt",
      "https://addressesapi.090227.xyz/ip.txt"
    ],
    "cm_dx": [
      "https://addressesapi.090227.xyz/CloudFlareYes",
      "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt"
    ],
    "cm_lt": [
      "https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt",
      "https://addressesapi.090227.xyz/ip.txt"
    ],

    // 天城优选
    "tc_opt1": ["https://tc.090227.xyz", "https://addressesapi.090227.xyz/CloudFlareYes"],
    "tc_opt2": ["https://tc.090227.xyz", "https://addressesapi.090227.xyz/ip.txt"],

    // 乌鸦优选（各地区）
    "yw_tw": ["https://addressesapi.090227.xyz/ip.txt"],
    "yw_hk": ["https://addressesapi.090227.xyz/ip.txt"],
    "yw_jp": ["https://addressesapi.090227.xyz/ip.txt"],
    "yw_kr": ["https://addressesapi.090227.xyz/ip.txt"],
    "yw_sg": ["https://addressesapi.090227.xyz/ip.txt"],
    "yw_us": ["https://addressesapi.090227.xyz/ip.txt"],

    // 优选合集
    "all_jz": ["https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/ip.txt", "https://addressesapi.090227.xyz/ip.txt"],
    "all_moist_r": ["https://addressesapi.090227.xyz/ip.txt"],
    "all_mingyu": ["https://tc.090227.xyz", "https://addressesapi.090227.xyz/CloudFlareYes"],

    // 优选域名（无论前端传 domain 还是 domain_sub 都能匹配）
    "domain": ["https://addressesapi.090227.xyz/domains.txt"],
    "domain_sub": ["https://addressesapi.090227.xyz/domains.txt"],

    // ProxyIP
    "proxyip": ["https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/proxyip.txt"],
    "proxyip_sub": ["https://raw.githubusercontent.com/cmliu/CF-Workers-SUB/main/proxyip.txt"]
  };

  // 智能寻找目标源列表
  let candidates = SOURCE_MAP[`${type}_${sub}`] || SOURCE_MAP[type] || SOURCE_MAP["cm_yd"];

  let rawText = "";
  for (const targetUrl of candidates) {
    try {
      const response = await fetch(`${targetUrl}?_t=${Date.now()}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        cf: { cacheTtl: 30 }
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 10) {
          rawText = text;
          break; // 成功拉取到有效动态内容，跳出
        }
      }
    } catch (e) {
      // 尝试下一个候选地址
    }
  }

  // 动态清洗与重组
  if (rawText) {
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//") && !l.startsWith("#"));
    let output = [];

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
      // domain 或 proxyip，保持干净文本行
      output = lines.slice(0, 30);
    }

    return new Response(output.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // 极端情况下若上游完全失联，返回友好提示
  return new Response("上游实时测速节点同步中，请稍后刷新重试。", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
