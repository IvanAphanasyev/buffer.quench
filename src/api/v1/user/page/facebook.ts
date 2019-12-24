import { Context } from "koa";
import Router from "koa-router";
const facebookRouter = new Router();
import { FacebookUser as FbUser, User as SysUser } from "../../../../models";
import { Repository, getManager } from "typeorm";
import { fbService as fb } from "../../../../lib";
import {
  IFacebookPage,
  IFacebookUser,
  IContext,
  IAuthState
} from "../../../../types";

facebookRouter.post("/", async (ctx: IContext<IAuthState>) => {
  const user_access_token_token_2h: string = ctx.request.body.token; //input facebook user access token with 2 h live

  const fbUser: IFacebookUser = await fb.getUser(user_access_token_token_2h); // get user from facebook by access token from client side
  const fbUserRepository: Repository<FbUser> = getManager().getRepository(
    // create facebook user repository
    FbUser
  );
  let localFbUser = await fbUserRepository.findOne({
    fbId: fbUser.id,
    user: ctx.state.user
  }); //find exist facebook user in database with all system users which links with that facebook user
  if (!localFbUser) {
    // if not exist need to create
    // new user in system, need create a new raw in db
    const fbUserModel = new FbUser();
    fbUserModel.fbId = fbUser.id;
    fbUserModel.accessToken = user_access_token_token_2h;
    fbUserModel.user = ctx.state.user;

    localFbUser = await fbUserRepository.save(fbUserModel);
  }

  const longUserToken = await fb.longLiveUserAccessToken(
    // generate access token for 60 days
    user_access_token_token_2h
  );
  localFbUser.accessToken = longUserToken.access_token;
  localFbUser = await fbUserRepository.save(localFbUser); //save new long acess token to database

  const pages: Array<IFacebookPage> = await fb.longLiveAccounts(
    //get user pages from facebook with 60d access token.....
    longUserToken.access_token,
    localFbUser.fbId
  );

  ctx.body = pages; // return pages for user
});
facebookRouter.delete("/", async (ctx: Context) => {
  ctx.body = "remove facebook account from current user";
});
export = facebookRouter;
