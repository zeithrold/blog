export default defineEventHandler(({ context }) => {
  return Response.json({
    context,
  })
})
