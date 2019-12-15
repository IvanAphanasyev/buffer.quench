import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  OneToOne,
  OneToMany
} from "typeorm";
import { Length, IsEmail } from "class-validator";
import Refresh from "./refresh";
import FacebookUser from "./facebook/facebookUser";
@Entity()
@Index(["email"], { unique: true })
export default class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  @IsEmail()
  email: string;

  @Column()
  @Length(5, 30)
  password: string;

  @OneToOne(
    type => Refresh,
    refresh => refresh.user
  )
  refresh: Refresh;

  @OneToOne(
    type => FacebookUser,
    facebookUser => facebookUser.user
  )
  facebookUser: FacebookUser;
}
