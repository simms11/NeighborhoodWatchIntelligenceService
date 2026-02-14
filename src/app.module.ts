import { Module } from '@nestjs/common';
import { CrimeModule } from './modules/crime/crime.module';
@Module({
  imports: [CrimeModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
