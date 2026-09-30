export function publicHead(_path: string, title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
    ],
  };
}
