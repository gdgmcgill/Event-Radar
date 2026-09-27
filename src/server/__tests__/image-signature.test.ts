/** M0 CERT-02: do not trust an uploaded file's declared image MIME. */
import { checkFileContent } from "../body";
import { imageBytes } from "../../__tests__/helpers/imageBytes";
it.each(["image/png","image/jpeg","image/gif","image/webp"])("allows an agreeing %s header", async (type) => {
  expect(await checkFileContent(new File([imageBytes(24,type)],"fixture",{type}))).toBeNull();
});
it.each(["image/png","image/jpeg","image/gif","image/webp"])("refuses disguised executable bytes declared %s", async (type) => {
  const response = await checkFileContent(new File(["MZ executable"],"payload.png",{type}));
  expect(response?.status).toBe(400);
  expect(await response?.json()).toEqual({error:"File content does not match its image type"});
});
it("refuses a truncated PNG and a mismatched genuine signature", async () => {
  expect((await checkFileContent(new File([imageBytes(4,"image/png")],"truncated.png",{type:"image/png"})))?.status).toBe(400);
  expect((await checkFileContent(new File([imageBytes(12,"image/gif")],"spoof.png",{type:"image/png"})))?.status).toBe(400);
});
it("reads only the first twelve bytes", async () => {
  const file = new File([imageBytes(1024,"image/png")],"bounded.png",{type:"image/png"});
  const spy = jest.spyOn(file,"slice");
  await checkFileContent(file);
  expect(spy).toHaveBeenCalledWith(0,12);
});
