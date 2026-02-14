import { Injectable } from "@angular/core";
import { User } from "../../services/auth/auth.service";
import { JwtHelperService } from '@auth0/angular-jwt';


@Injectable({
    providedIn: 'root'   // This makes it available app-wide
})
export default class TokenDecode {

    decodePayloadFromToken() {
        const token = localStorage.getItem('token')
        if (token) {
            try {
                const jwtService = new JwtHelperService();
                const decodedToken = jwtService.decodeToken(token);

                const user: User = {
                    firstname: decodedToken.firstName,
                    lastname: decodedToken.lastName,
                    email: decodedToken.email,
                    username: decodedToken.unique_name
                };
                return user;
            }
            catch (error) {
                console.error('Invalid Token', error);
                return null;
            }
        }

        return null;
    }
}