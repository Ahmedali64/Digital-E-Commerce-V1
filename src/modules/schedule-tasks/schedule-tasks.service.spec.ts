import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleTasksService } from './schedule-tasks.service';

describe('ScheduleTasksService', () => {
  let service: ScheduleTasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduleTasksService],
    }).compile();

    service = module.get<ScheduleTasksService>(ScheduleTasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
