export function GET(request: Request) {
  return Response.redirect(new URL("/apple-icon.png", request.url), 308);
}
