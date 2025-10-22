export async function uploadImageToIPFS(file) {
    const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiZTkwODNiNy04MDU5LTQ3MjAtYjk1Mi0xYTdkMDUzOThlN2EiLCJlbWFpbCI6InhpYW9qdW50YW5nODBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImE2MDI0Mjg0NzZjOWUyYzkyYjAyIiwic2NvcGVkS2V5U2VjcmV0IjoiMjc3ZjYyZDU0OGI5YmRhYmVkYjdmNDdiNjE4ZjAwM2YwNGNkMjhhMzYxNjczMGM5ZmVjYTcxZjIxMTNhNmI5ZSIsImV4cCI6MTc5MjQyNTA1OX0.YbaiaONt46vBlmVFvhDqZN5RtwOqbvt2VJPFPa8Qw6s"; // 替换为刚复制的JWT

    if (!file) return ""; // 无文件时返回空字符串（避免后续处理null）

    try {
        const formData = new FormData();
        formData.append("file", file);

        // 关键：使用Authorization头 + JWT认证
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${PINATA_JWT}`, // 新认证方式
                // 移除旧的pinata_api_key和pinata_secret_api_key
            },
            body: formData,
        });

        // 打印响应状态（方便排查）
        console.log("Pinata响应状态：", response.status);
        const data = await response.json();
        console.log("Pinata返回数据：", data);

        if (!response.ok) {
            throw new Error(`Pinata错误：${data.error || "未知错误"}`);
        }

        // 返回IPFS链接（优先用Pinata网关）
        return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
    } catch (error) {
        console.error("❌ IPFS上传失败：", error.message);
        throw new Error(`图片上传失败：${error.message}`); // 抛出错误让上层处理
    }
}