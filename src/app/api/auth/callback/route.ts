import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie } from "@/lib/auth";
import { getUserInfo } from "@/lib/secondme";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", req.url));
  }

  try {
    // 用 code 换 token
    const tokenRes = await fetch(process.env.SECONDME_TOKEN_ENDPOINT!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SECONDME_REDIRECT_URI!,
        client_id: process.env.SECONDME_CLIENT_ID!,
        client_secret: process.env.SECONDME_CLIENT_SECRET!,
      }),
    });

    const tokenText = await tokenRes.text();
    console.log("Token response status:", tokenRes.status);
    console.log("Token response body:", tokenText);
    const tokenData = JSON.parse(tokenText);

    // 兼容两种格式：{ data: { access_token } } 或 { access_token }
    const tokenPayload = tokenData.data || tokenData;
    if (!tokenPayload.accessToken && !tokenPayload.access_token) {
      return NextResponse.redirect(new URL("/?error=token_failed", req.url));
    }

    const access_token = tokenPayload.accessToken || tokenPayload.access_token;
    const refresh_token = tokenPayload.refreshToken || tokenPayload.refresh_token;
    const expires_in = tokenPayload.expiresIn || tokenPayload.expires_in;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // 获取用户信息
    const userInfo = await getUserInfo(access_token);

    // 创建或更新用户
    const user = await prisma.user.upsert({
      where: { secondmeUserId: userInfo.userId || userInfo.id },
      update: {
        name: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.avatar || userInfo.avatarUrl,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      },
      create: {
        secondmeUserId: userInfo.userId || userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.avatar || userInfo.avatarUrl,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      },
    });

    await setAuthCookie(user.id);

    // 新用户去 onboarding，老用户去 dashboard
    const hasAgent = await prisma.agentProfile.findUnique({
      where: { userId: user.id },
    });
    const redirectPath = hasAgent ? "/dashboard" : "/onboarding";

    return NextResponse.redirect(new URL(redirectPath, req.url));
  } catch (e) {
    console.error("OAuth callback error:", e);
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
