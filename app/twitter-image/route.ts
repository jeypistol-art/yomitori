export function GET(request: Request) {
  return Response.redirect(
    new URL("/images/ogp-yomitori-docutask.png", request.url),
    308
  );
}
