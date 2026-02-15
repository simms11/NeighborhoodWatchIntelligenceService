import {Module} from "@nestjs/common";
import {HttpModule} from "@nestjs/axios";
import {LocationService} from "./location.service";

@Module({
    imports: [HttpModule],
    providers: [LocationService],
    exports: [LocationService],
})

export class LocationModule{}