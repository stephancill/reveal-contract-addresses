export const getHostFromURL = (url: string) => {
  try {
    url = url.split("://")[1].split("/")[0]
  } catch (error) {}
  return url
}