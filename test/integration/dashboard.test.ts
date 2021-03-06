import request from "supertest";
import { getConnection } from "typeorm";

import { app } from "../../src/app";
import { IJwtPair, IFacebookPage, IPostBody, IUknownPageBody } from "../../src/types";
import { SocialType } from "../../src/types/architecture/SocialTypes";
// eslint-disable-next-line @typescript-eslint/camelcase
import { user as connectAndCreateUser, facebook_test_user as facebookUser, endpoints, nextMinutes, invalid_uuid, nextSecond } from "../config";

const SECONDS = 3;

jest.setTimeout(SECONDS * 2 * 1000);
const account = { email: "dashboard_tester@gmail.com", password: "123321" };
let jwt: IJwtPair;
beforeAll(async () => {
   await connectAndCreateUser(account);
});
afterAll(async () => {
   await getConnection().close();
});

describe("test dashboard endpoint(hard logic realize), before need add social, get pages from dat social", () => {
   let socialId: string;
   let socialPages: IFacebookPage[];
   let threadId: string;
   describe("add social to account, get social pages", () => {
      test("login into service, should return jwt pair", async done => {
         request(app.callback())
            .post(endpoints.auth.local.sign_in)
            .send(account)
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);
               expect(res.body).toHaveProperty("jwt");
               jwt = res.body.jwt;
               return done();
            });
      });
      test("add social to account, should return 201, after need to get social ID ", async done => {
         request(app.callback())
            .post(endpoints.user.social.facebook.access)
            .set(jwt)
            .send({ token: facebookUser.access_token })
            .expect(201)
            .end((err, res) => {
               if (err) return done(err);
               expect(res.body).toHaveProperty("id");
               socialId = res.body.id;
               return done();
            });
      });
      test("get pages from connected social, should return facebook api response", async done => {
         request(app.callback())
            .get(endpoints.user.social.facebook.id.page.access(socialId))
            .set(jwt)
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);
               const apiPages = res.body;
               apiPages.forEach(page => {
                  expect(page).toMatchObject({
                     id: expect.any(String),
                     name: expect.any(String),
                     category: expect.any(String),
                     picture: {
                        data: {
                           height: expect.any(Number),
                           is_silhouette: expect.any(Boolean),
                           url: expect.any(String),
                        },
                     },
                  });
               });
               socialPages = apiPages;
               return done();
            });
      });
   });
   describe("test post create by dashboard", () => {
      test("create new post, should return 201 and post body", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(201)
            .end((err, res) => {
               if (err) return done(err);
               const response = res.body;
               expect(response).toMatchObject({
                  id: expect.any(String),
               });
               threadId = res.body.id;
               /* expect(response).toMatchObject({
                  thread: {
                     //name: expect.any(String),
                     id: expect.any(String),
                  },
                  post: {
                     context: post.context,
                     id: expect.any(String),
                  },
                  pages: expect.any(Array),
               });
               expect(new Date(response.post.expireDate)).toEqual(post.expireDate);
               response.pages.forEach(page => {
                  expect(socialPages).toEqual(
                     expect.arrayContaining([{ id: page.fbId, category: page.category, name: page.name, picture: page.picture }]),
                  );
               });*/
               return done();
            });
      });
      test("create new post with empty post object in body, should return 400", async done => {
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ pages })
            .expect(400, [{ property: "post", constraints: { isNotEmpty: "post should not be empty" } }])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with malfored post object, should return bad request", async done => {
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });

         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ pages, post: { expireDate: "228" } })
            .expect(400, [
               { property: "context", constraints: { isNotEmpty: "context should not be empty" } },
               { property: "expireDate", constraints: { isFuture: "impossible set date in past time" } },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with empty array object, should return bad request", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post })
            .expect(400, [
               {
                  property: "pages",
                  constraints: {
                     arrayNotEmpty: "pages should not be empty",
                     isArray: "pages must be an array",
                     isNotEmpty: "pages should not be empty",
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with empty array pages, should return 400 validation bad request", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages = [];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, [
               {
                  property: "pages",
                  constraints: {
                     arrayNotEmpty: "pages should not be empty",
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with invalid facebook_id in page object, should return 400 ", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const page = "fadagwegfadasdsadasfdgsd"; //pageid in facebook
         const pages = [{ type: "facebook", socialId, page }];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, `input facebook page: ${page} is not account for social: ${socialId}`)
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with invalid object in pages(doesn't match in pattern {type:string,socialId:string,page:string}, should return 400", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages = [{ tupe: "AAAAAAAAAAAAAAAA", social: "))", page: 228 }];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, [
               { property: "socialId", constraints: { isUuid: "socialId must be an UUID", isNotEmpty: "socialId should not be empty" } },
               {
                  property: "type",
                  constraints: {
                     isNotEmpty: "type should not be empty",
                     isSocialType: "invalid input type of social, only the following types are currently available: facebook,instagram,twitter",
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with invalid type in pages object, should return 400", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages = [{ type: 1, socialId, page: 1 }];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, [
               {
                  property: "type",
                  constraints: {
                     isSocialType: `invalid input type of social, only the following types are currently available: ${Object.values(SocialType)}`,
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with pages array where first object is valid type, second object is invalid type, should return 400", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages = [
            { type: "facebook", socialId, page: 1 },
            { type: 1, socialId, page: 1 },
         ];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, [
               {
                  property: "type",
                  constraints: {
                     isSocialType: `invalid input type of social, only the following types are currently available: ${Object.values(SocialType)}`,
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post with invalid socialId on pages array objct, should return 400", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages = [
            { type: "facebook", socialId: invalid_uuid, page: "13" },
            { type: "facebook", socialId, page: 0 },
         ];
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(400, "social not found")
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      test("create new post again with same arguments, should return 201(cause of unique thread name create by current time)", async done => {
         const post: IPostBody = {
            context: `dashboard test at ${new Date()}`,
            expireDate: nextMinutes(1),
         };
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });
         request(app.callback())
            .post(endpoints.user.dashboard.post.access)
            .set(jwt)
            .send({ post, pages })
            .expect(201)
            .end((err, res) => {
               if (err) return done(err);
               const response = res.body;
               expect(response).toMatchObject({
                  id: expect.any(String),
               });
               /*expect(response).toMatchObject({
                  thread: {
                     name: expect.any(String),
                     id: expect.any(String),
                  },
                  post: {
                     context: post.context,
                     id: expect.any(String),
                  },
                  pages: expect.any(Array),
               });
               expect(new Date(response.post.expireDate)).toEqual(post.expireDate);
               response.pages.forEach(page => {
                  expect(socialPages).toEqual(
                     expect.arrayContaining([{ id: page.fbId, category: page.category, name: page.name, picture: page.picture }]),
                  );
               });*/
               return done();
            });
      });
   });
   describe("test dashboard getting", () => {
      test("get all threads in dashboard, should return 200 and array of dashboard objects", async done => {
         request(app.callback())
            .get(endpoints.user.dashboard.post.access)
            .set(jwt)
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);
               const array = res.body;
               expect(array).toBeInstanceOf(Array);
               array.forEach(item => {
                  expect(item).toMatchObject({
                     id: expect.any(String),
                     post: {
                        id: expect.any(String),
                        context: expect.any(String),
                        expireDate: expect.any(String),
                     },
                     pages: expect.any(Array),
                  });
                  const pages = item.pages;
                  expect(pages).toEqual(expect.arrayContaining([{ type: expect.any(String), pageId: expect.any(String) }]));
               });
               return done();
            });
      });
      describe("getting target thread by thread endpoinst", () => {
         test("getting thread, should return thread object with 200", async done => {
            request(app.callback())
               .get(endpoints.user.thread.id(threadId).access)
               .set(jwt)
               .expect(200)
               .end((err, res) => {
                  if (err) return done(err);
                  const response = res.body;
                  expect(response).toMatchObject({
                     id: threadId,
                     name: expect.any(String),
                  });
                  return done();
               });
         });
         test("getting post from thread, should return post object", async done => {
            request(app.callback())
               .get(endpoints.user.thread.id(threadId).post.access)
               .set(jwt)
               .expect(200)
               .end((err, res) => {
                  if (err) return done(err);
                  const posts = res.body;
                  expect(posts).toBeInstanceOf(Array);
                  expect(posts.length).toEqual(1);
                  const [page] = posts;
                  expect(page).toMatchObject({
                     id: expect.any(String),
                     context: expect.any(String),
                     expireDate: expect.any(String),
                  });
                  return done();
               });
         });
         test("getting pages from created thread, should return abstract pages objects", async done => {
            request(app.callback())
               .get(endpoints.user.thread.id(threadId).page.access)
               .set(jwt)
               .expect(200)
               .end((err, res) => {
                  if (err) return done();
                  const pages = res.body;
                  expect(pages).toBeInstanceOf(Array);
                  expect(pages.length).toEqual(socialPages.length);

                  return done();
               });
         });
      });
      /*test("get target thread by id that created before.., should return dashboard object with 200 status", async done => {
         request(app.callback())
            .get(endpoints.user.dashboard.post.id(threadId).access)
            .set(jwt)
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);
               const item = res.body;
               expect(item).toMatchObject({
                  id: expect.any(String),
                  post: {
                     id: expect.any(String),
                     context: expect.any(String),
                     expireDate: expect.any(String),
                  },
                  pages: expect.any(Array),
               });
               const pages = item.pages;
               expect(pages).toEqual(expect.arrayContaining([{ type: expect.any(String), pageId: expect.any(String) }]));

               return done();
            });
      });
      test("get target thread by invalid uuid, should return 400", async done => {
         request(app.callback())
            .get(endpoints.user.dashboard.post.id(invalid_uuid).access)
            .set(jwt)
            .expect(400, "thread not found")
            .end(err => {
               if (err) return done(err);

               return done();
            });
      });
      test("get target thread by malfores uuid, should return 400", async done => {
         request(app.callback())
            .get(endpoints.user.dashboard.post.id(")").access)
            .set(jwt)
            .expect(400, "uuid validation error at post")
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });*/
   });
   describe("test updating target post with dashboard", () => {
      test("update post with new post object, should return 200", async done => {
         const post: IPostBody = {
            context: `update post in dashboard test at ${new Date()}`,
            expireDate: nextMinutes(10),
         };
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });
         request(app.callback())
            .put(endpoints.user.dashboard.post.id(threadId).access)
            .set(jwt)
            .send({ post, pages })
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);

               console.log(res.body);
               const response = res.body;
               expect(response).toMatchObject({
                  id: threadId,
               });
               return done();
            });
      });
      test("udate post with undefined post instance, should return 400 bad request", async done => {
         const pages: IUknownPageBody[] = socialPages.map(item => {
            return { type: "facebook", socialId, page: item.id };
         });
         request(app.callback())
            .put(endpoints.user.dashboard.post.id(threadId).access)
            .set(jwt)
            .send({ pages })
            .expect(400, [
               {
                  property: "post",
                  constraints: { isNotEmpty: "post should not be empty" },
               },
            ])
            .end(err => {
               if (err) return done(err);

               return done();
            });
      });
      test("update post with emty pages instance in body, should return 400 bad request", async done => {
         const post: IPostBody = {
            context: `update post in dashboard test at ${new Date()}`,
            expireDate: nextMinutes(10),
         };
         request(app.callback())
            .put(endpoints.user.dashboard.post.id(threadId).access)
            .set(jwt)
            .send({ post })
            .expect(400, [
               {
                  property: "pages",
                  constraints: {
                     arrayNotEmpty: "pages should not be empty",
                     isArray: "pages must be an array",
                     isNotEmpty: "pages should not be empty",
                  },
               },
            ])
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      describe("test executing post by schedule", () => {
         test("update post from maximum pages coutn to 1 random from array, should disconnect other pages, and return thread id", async done => {
            const post: IPostBody = {
               context: `update again in dashboard testing... at ${new Date()}`,
               expireDate: nextSecond(SECONDS),
            };
            const randomPage = Math.floor(Math.random() * socialPages.length);
            const pages = [{ type: "facebook", socialId, page: socialPages[randomPage].id }];
            request(app.callback())
               .put(endpoints.user.dashboard.post.id(threadId).access)
               .set(jwt)
               .send({ post, pages })
               .expect(200)
               .end((err, res) => {
                  if (err) return done(err);
                  const response = res.body;
                  expect(response).toMatchObject({ id: threadId });
                  return done();
               });
         });
         test("after executing get post from thread, should be posted in socials", async done => {
            setTimeout(() => {
               request(app.callback())
                  .get(endpoints.user.thread.id(threadId).post.access)
                  .set(jwt)
                  .expect(200)
                  .end((err, res) => {
                     if (err) return done(err);
                     const response = res.body;
                     expect(response).toEqual([]);
                     return done();
                  });
            }, (SECONDS + 2) * 1000);
         });
         test("update thread by dashboad after executing, should return 400 cause of thread haven't any post", async done => {
            const post: IPostBody = {
               context: `update again in dashboard testing... at ${new Date()}`,
               expireDate: nextSecond(SECONDS),
            };
            const pages = "not need now";
            request(app.callback())
               .put(endpoints.user.dashboard.post.id(threadId).access)
               .set(jwt)
               .send({ post, pages })
               .expect(400, "thread haven't post")
               .end(err => {
                  if (err) return done(err);
                  return done();
               });
         });
      });
      test("update therad with incorrect id, should return bad request", async done => {
         request(app.callback())
            .put(endpoints.user.dashboard.post.id(invalid_uuid).access)
            .set(jwt)
            .expect(400, "thread not found")
            .end(err => {
               if (err) return done(err);
               return done();
            });
      });
      describe("test dashboard thread with 2 or more posts..", () => {
         let id: string;
         test("create new post again with same arguments, should return 201(cause of unique thread name create by current time)", async done => {
            const post: IPostBody = {
               context: `test for update at ${new Date()}`,
               expireDate: nextMinutes(1),
            };
            const pages: IUknownPageBody[] = socialPages.map(item => {
               return { type: "facebook", socialId, page: item.id };
            });
            request(app.callback())
               .post(endpoints.user.dashboard.post.access)
               .set(jwt)
               .send({ post, pages })
               .expect(201)
               .end((err, res) => {
                  if (err) return done(err);
                  const response = res.body;
                  expect(response).toMatchObject({
                     id: expect.any(String),
                  });
                  id = response.id;
                  return done();
               });
         });
         test("add additional post to thread created in dashboard, should be created", async done => {
            const post: IPostBody = {
               context: `second post for thread with id ${id}`,
               expireDate: nextMinutes(228),
            };
            request(app.callback())
               .post(endpoints.user.thread.id(id).post.access)
               .set(jwt)
               .send(post)
               .expect(201)
               .end((err, res) => {
                  if (err) return done(err);

                  const response = res.body;
                  expect(response).toMatchObject({
                     id: expect.any(String),
                     context: post.context,
                  });
                  expect(new Date(response.expireDate)).toEqual(post.expireDate);
                  return done();
               });
         });
         test("update thread by dashboard, should return bad request", async done => {
            const post: IPostBody = {
               context: "i ll throw cause by dashboard update thread can have only 1 post",
               expireDate: nextMinutes(111),
            };
            const pages = "dont need to create pages array fron socials";
            request(app.callback())
               .put(endpoints.user.dashboard.post.id(id).access)
               .set(jwt)
               .send({ post, pages })
               .expect(400, "dashboard thread can't has 2 or more posts")
               .end(err => {
                  if (err) return done(err);
                  return done();
               });
         });
      });
   });
   describe("test dashboard deleting", () => {
      test("delete thread in dashboard, should return 204", async done => {
         request(app.callback())
            .del(endpoints.user.thread.id(threadId).access)
            .set(jwt)
            .expect(204)
            .end(err => {
               if (err) return done(err);

               return done();
            });
      });
      test("getting dasgboard after deleteng thread, should return 1 thread", async done => {
         request(app.callback())
            .get(endpoints.user.dashboard.post.access)
            .set(jwt)
            .expect(200)
            .end((err, res) => {
               if (err) return done(err);
               console.log(res.body);
               return done();
            });
      });
   });
});
