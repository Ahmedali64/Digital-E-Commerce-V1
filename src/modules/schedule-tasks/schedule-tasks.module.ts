import { Module } from '@nestjs/common';
import { ScheduleTasksService } from './schedule-tasks.service';
import { FilesModule } from '../files/files.module';

@Module({
  providers: [ScheduleTasksService],
  imports: [FilesModule],
})
export class ScheduleTasksModule {}
