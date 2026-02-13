import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { BunnyUploadService } from './bunny-upload.service';
import {
  CourseWithProgress, CourseDetail, ModuleProgress, EnrollmentType, ModuleType,
  ModuleDetail, ModuleViewerData, ModuleContent, ModuleFile, ModuleNavItem, ModuleVideo,
  CourseFormData, TenantSummary, TenantAssignment, LectureFormData,
  ModuleSavePayload, ModuleContentFormData,
  PdfFormData, ExamFormData, ExamContent, ModulePdf, MarkdownFormData, ModuleMarkdownContent,
  QuizFormData, QuizContent, QuizQuestionType, QuizQuestionFormData,
  ExternalQuizFormData, ExternalQuizContent,
  EnrolledUser, UserProgressSummary, UserProgressRecord, MarkedByType,
  QuizTakingData, QuizTakingQuestion, QuizAttempt, QuizGradeResult, QuizQuestionResult, QuizResults, QuizAnswerMap,
  ExamTakingData, ExamSubmission,
} from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #bunnyUpload = inject(BunnyUploadService);

  #courses = signal<CourseWithProgress[]>([]);
  #courseDetail = signal<CourseDetail | null>(null);
  #moduleViewer = signal<ModuleViewerData | null>(null);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly courseDetail = this.#courseDetail.asReadonly();
  readonly moduleViewer = this.#moduleViewer.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadCourses() {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      const [coursesRes, modulesRes, progressRes, enrollmentsRes] = await Promise.all([
        client.from('courses').select('id, title, description, thumbnail_url, enrollment_type').order('title'),
        client.from('modules').select('id, course_id'),
        client.from('user_progress').select('module_id, course_id, status, updated_at').eq('user_id', userId),
        client.from('course_enrollments').select('course_id').eq('user_id', userId),
      ]);

      const firstError = [coursesRes, modulesRes, progressRes, enrollmentsRes].find(r => r.error);
      if (firstError?.error) throw firstError.error;

      const courses = coursesRes.data ?? [];
      const modules = modulesRes.data ?? [];
      const progress = progressRes.data ?? [];
      const enrollments = enrollmentsRes.data ?? [];

      const enrolledCourseIds = new Set(enrollments.map((e: { course_id: string }) => e.course_id));

      const moduleCountByCourse = new Map<string, number>();
      for (const m of modules) {
        const cid = (m as { course_id: string }).course_id;
        moduleCountByCourse.set(cid, (moduleCountByCourse.get(cid) ?? 0) + 1);
      }

      const completedByCourse = new Map<string, number>();
      const lastActivityByCourse = new Map<string, string>();
      for (const p of progress) {
        const rec = p as { course_id: string; status: string; updated_at: string };
        if (rec.status === 'completed') {
          completedByCourse.set(rec.course_id, (completedByCourse.get(rec.course_id) ?? 0) + 1);
        }
        const prev = lastActivityByCourse.get(rec.course_id);
        if (!prev || rec.updated_at > prev) {
          lastActivityByCourse.set(rec.course_id, rec.updated_at);
        }
      }

      const result: CourseWithProgress[] = courses.map((c: { id: string; title: string; description: string | null; thumbnail_url: string | null; enrollment_type: string }) => {
        const moduleCount = moduleCountByCourse.get(c.id) ?? 0;
        const completedModules = completedByCourse.get(c.id) ?? 0;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          thumbnail_url: c.thumbnail_url,
          enrollment_type: c.enrollment_type as EnrollmentType,
          moduleCount,
          completedModules,
          progressPercent: moduleCount > 0 ? Math.round((completedModules / moduleCount) * 100) : 0,
          isEnrolled: enrolledCourseIds.has(c.id),
          lastActivity: lastActivityByCourse.get(c.id) ?? null,
        };
      });

      this.#courses.set(result);
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load courses'));
    } finally {
      this.#loading.set(false);
    }
  }

  async loadCourseDetail(courseId: string) {
    this.#loading.set(true);
    this.#error.set('');
    this.#courseDetail.set(null);

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      const [courseRes, progressRes, enrollmentRes] = await Promise.all([
        client
          .from('courses')
          .select('id, title, description, thumbnail_url, enrollment_type, lectures(id, title, description, sort_order, modules(id, title, module_type, sort_order))')
          .eq('id', courseId)
          .order('sort_order', { referencedTable: 'lectures' })
          .order('sort_order', { referencedTable: 'lectures.modules' })
          .single(),
        client
          .from('user_progress')
          .select('module_id, status, completed_at')
          .eq('course_id', courseId)
          .eq('user_id', userId),
        client
          .from('course_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (courseRes.error) throw courseRes.error;
      if (progressRes.error) throw progressRes.error;
      if (enrollmentRes.error) throw enrollmentRes.error;

      const course = courseRes.data as {
        id: string;
        title: string;
        description: string | null;
        thumbnail_url: string | null;
        enrollment_type: string;
        lectures: {
          id: string;
          title: string;
          description: string | null;
          sort_order: number;
          modules: { id: string; title: string; module_type: string; sort_order: number }[];
        }[];
      };

      const progressMap: Record<string, ModuleProgress> = {};
      for (const p of (progressRes.data ?? [])) {
        const rec = p as { module_id: string; status: string; completed_at: string | null };
        progressMap[rec.module_id] = { status: rec.status as ModuleProgress['status'], completed_at: rec.completed_at };
      }

      this.#courseDetail.set({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        enrollment_type: course.enrollment_type as EnrollmentType,
        isEnrolled: !!enrollmentRes.data,
        lectures: (course.lectures ?? []).map(l => ({
          ...l,
          modules: l.modules.map(m => ({ ...m, module_type: m.module_type as ModuleType })),
        })),
        progressMap,
      });
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load course'));
    } finally {
      this.#loading.set(false);
    }
  }

  async loadModuleViewer(courseId: string, moduleId: string) {
    this.#loading.set(true);
    this.#error.set('');
    this.#moduleViewer.set(null);

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      // Step 1: Fetch module metadata
      const moduleRes = await client
        .from('modules')
        .select('id, title, description, module_type, sort_order, lecture_id, course_id')
        .eq('id', moduleId)
        .single();

      if (moduleRes.error) throw moduleRes.error;

      const mod = moduleRes.data as {
        id: string; title: string; description: string | null;
        module_type: string; sort_order: number; lecture_id: string; course_id: string;
      };

      // Step 2: Fetch content + files + progress in parallel
      const contentPromise = this.#fetchModuleContent(client, moduleId, mod.module_type);
      const [filesRes, progressRes] = await Promise.all([
        client.from('module_files').select('id, file_url, file_name, file_size').eq('module_id', moduleId),
        client.from('user_progress').select('status, completed_at').eq('module_id', moduleId).eq('user_id', userId).maybeSingle(),
      ]);
      const content = await contentPromise;

      if (filesRes.error) throw filesRes.error;
      if (progressRes.error) throw progressRes.error;

      // Step 3: Build navigation from courseDetail
      if (!this.#courseDetail() || this.#courseDetail()!.id !== courseId) {
        await this.loadCourseDetail(courseId);
      }
      const navigation = this.#buildNavigation(moduleId);

      const module: ModuleDetail = {
        ...mod,
        module_type: mod.module_type as ModuleType,
      };

      // module_files store storage paths — resolve to signed URLs for downloading.
      // Files whose storage objects have been deleted will return null and are filtered out.
      const rawFiles = (filesRes.data ?? []) as { id: string; file_url: string; file_name: string; file_size: number | null }[];
      const resolvedFiles = await Promise.all(
        rawFiles.map(async (f) => ({
          ...f,
          file_url: await this.#getSignedUrl(f.file_url),
        })),
      );
      const files: ModuleFile[] = resolvedFiles.filter(
        (f): f is ModuleFile => f.file_url !== null,
      );

      const progress: ModuleProgress | null = progressRes.data
        ? { status: (progressRes.data as { status: string }).status as ModuleProgress['status'], completed_at: (progressRes.data as { completed_at: string | null }).completed_at }
        : null;

      this.#moduleViewer.set({ module, content, files, progress, navigation });
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load module'));
    } finally {
      this.#loading.set(false);
    }
  }

  async markModuleComplete(moduleId: string) {
    const viewer = this.#moduleViewer();
    if (!viewer) return;

    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) return;

    const { error } = await this.#supabase.client
      .from('user_progress')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        course_id: viewer.module.course_id,
        lecture_id: viewer.module.lecture_id,
        module_id: moduleId,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        marked_by: 'user' as const,
      }, { onConflict: 'user_id,tenant_id,module_id' });

    if (error) {
      this.#error.set(this.#extractErrorMessage(error, 'Failed to mark complete'));
      return;
    }

    // Update local state
    this.#moduleViewer.set({
      ...viewer,
      progress: { status: 'completed', completed_at: new Date().toISOString() },
    });
  }

  // --- Phase 4A: Enrollment methods ---

  async enrollInOpenCourse(courseId: string): Promise<void> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .insert({ user_id: userId, tenant_id: tenantId, course_id: courseId });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to enroll'));
    await this.loadCourseDetail(courseId);
  }

  async enrollWithPassword(courseId: string, password: string): Promise<void> {
    const { error } = await this.#supabase.client
      .rpc('enroll_with_password', { p_course_id: courseId, p_password: password });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to enroll'));
    await this.loadCourseDetail(courseId);
  }

  async adminEnrollUser(userId: string, tenantId: string, courseId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .insert({ user_id: userId, tenant_id: tenantId, course_id: courseId });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to enroll user'));
  }

  async unenrollUser(enrollmentId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to unenroll user'));
  }

  async loadEnrolledUsers(courseId: string): Promise<EnrolledUser[]> {
    const { data, error } = await this.#supabase.client
      .from('course_enrollments')
      .select('id, user_id, enrolled_at, profiles(email, full_name)')
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load enrolled users'));

    return (data ?? []).map((row) => {
      const profile = row.profiles as unknown as { email: string; full_name: string | null } | null;
      return {
        id: row.id,
        user_id: row.user_id,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        enrolled_at: row.enrolled_at,
      };
    });
  }

  async lookupUserByEmail(email: string, tenantId: string): Promise<{ id: string; full_name: string | null } | null> {
    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to look up user'));
    return data ? { id: data.id, full_name: data.full_name } : null;
  }

  // --- Phase 4B: Progress admin methods ---

  async loadCourseProgressAdmin(courseId: string): Promise<UserProgressSummary[]> {
    const client = this.#supabase.client;

    const [enrollmentsRes, progressRes] = await Promise.all([
      client
        .from('course_enrollments')
        .select('user_id, tenant_id, profiles(email, full_name)')
        .eq('course_id', courseId),
      client
        .from('user_progress')
        .select('user_id, module_id, status, completed_at, marked_by')
        .eq('course_id', courseId),
    ]);

    if (enrollmentsRes.error) throw new Error(this.#extractErrorMessage(enrollmentsRes.error, 'Failed to load enrollments'));
    if (progressRes.error) throw new Error(this.#extractErrorMessage(progressRes.error, 'Failed to load progress'));

    const detail = this.#courseDetail();
    const totalModules = detail
      ? detail.lectures.reduce((sum, l) => sum + l.modules.length, 0)
      : 0;

    const progressByUser = new Map<string, UserProgressRecord[]>();
    for (const p of (progressRes.data ?? [])) {
      const rec = p as { user_id: string; module_id: string; status: string; completed_at: string | null; marked_by: string | null };
      const list = progressByUser.get(rec.user_id) ?? [];
      list.push({
        module_id: rec.module_id,
        status: rec.status as UserProgressRecord['status'],
        completed_at: rec.completed_at,
        marked_by: rec.marked_by as MarkedByType | null,
      });
      progressByUser.set(rec.user_id, list);
    }

    return (enrollmentsRes.data ?? []).map((row) => {
      const profile = row.profiles as unknown as { email: string; full_name: string | null } | null;
      const records = progressByUser.get(row.user_id) ?? [];
      const modules: Record<string, UserProgressRecord> = {};
      let completed = 0;
      for (const r of records) {
        modules[r.module_id] = r;
        if (r.status === 'completed') completed++;
      }
      return {
        user_id: row.user_id,
        tenant_id: row.tenant_id,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        completed,
        total: totalModules,
        modules,
      };
    });
  }

  async adminMarkModuleComplete(userId: string, tenantId: string, courseId: string, lectureId: string, moduleId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('user_progress')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        course_id: courseId,
        lecture_id: lectureId,
        module_id: moduleId,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        marked_by: 'admin' as const,
      }, { onConflict: 'user_id,tenant_id,module_id' });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to mark module complete'));
  }

  async adminResetModuleProgress(userId: string, moduleId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('user_progress')
      .update({
        status: 'not_started' as const,
        completed_at: null,
        marked_by: null,
        notes: 'Reset by admin',
      })
      .eq('user_id', userId)
      .eq('module_id', moduleId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to reset module progress'));
  }

  // --- Phase 5A: Quiz Taking methods ---

  async loadQuizForTaking(moduleId: string): Promise<{ quiz: QuizTakingData; pastAttempts: QuizAttempt[] } | null> {
    const client = this.#supabase.client;
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return null;

    // 1. Quiz metadata (from quizzes table — no answers here)
    const { data: quiz, error: quizErr } = await client
      .from('quizzes')
      .select('id, title, description, time_limit, passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers')
      .eq('module_id', moduleId)
      .maybeSingle();

    if (quizErr || !quiz) return null;

    // 2. Questions from SAFE view (no correct_answer)
    const { data: questions, error: qErr } = await client
      .from('quiz_questions_safe')
      .select('id, question_text, question_type, points, sort_order')
      .eq('quiz_id', quiz.id)
      .order('sort_order');

    if (qErr || !questions) return null;

    // 3. Options from SAFE view (no is_correct) — batch query for all questions
    const questionIds = questions.map((q: { id: string }) => q.id);
    const { data: allOptions, error: oErr } = await client
      .from('quiz_question_options_safe')
      .select('id, question_id, option_text, sort_order')
      .in('question_id', questionIds)
      .order('sort_order');

    if (oErr) return null;

    // 4. For matching questions, fetch terms via SECURITY DEFINER RPC
    //    (learners can't read base quiz_questions table directly — RLS blocks it)
    const matchingQuestions = questions.filter((q: { question_type: string }) => q.question_type === 'matching');
    let matchingTerms: Record<string, { left: string[]; right: string[] }> = {};
    if (matchingQuestions.length > 0) {
      const matchingIds = matchingQuestions.map((q: { id: string }) => q.id);
      const { data: termsData } = await client
        .rpc('get_matching_question_terms', { p_question_ids: matchingIds });

      if (termsData && typeof termsData === 'object') {
        for (const [qId, terms] of Object.entries(termsData as Record<string, { left: string[]; right: string[] }>)) {
          const left = terms.left;
          const right = [...terms.right];
          // Shuffle right side using Fisher-Yates
          for (let i = right.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [right[i], right[j]] = [right[j], right[i]];
          }
          matchingTerms[qId] = { left, right };
        }
      }
    }

    // 5. Assemble questions with options
    const optionsByQuestion = new Map<string, { id: string; option_text: string; sort_order: number }[]>();
    for (const opt of (allOptions ?? [])) {
      const list = optionsByQuestion.get(opt.question_id) ?? [];
      list.push({ id: opt.id, option_text: opt.option_text, sort_order: opt.sort_order });
      optionsByQuestion.set(opt.question_id, list);
    }

    let assembledQuestions: QuizTakingQuestion[] = questions.map((q: { id: string; question_text: string; question_type: QuizQuestionType; points: number; sort_order: number }) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      points: q.points,
      sort_order: q.sort_order,
      options: optionsByQuestion.get(q.id) ?? [],
      ...(matchingTerms[q.id] ? { matchingLeft: matchingTerms[q.id].left, matchingRight: matchingTerms[q.id].right } : {}),
    }));

    // 6. Randomize if enabled
    if (quiz.randomize_questions) {
      for (let i = assembledQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [assembledQuestions[i], assembledQuestions[j]] = [assembledQuestions[j], assembledQuestions[i]];
      }
    }
    if (quiz.randomize_answers) {
      for (const q of assembledQuestions) {
        for (let i = q.options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
        }
      }
    }

    // 7. Past attempts
    const { data: pastAttempts } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('quiz_id', quiz.id)
      .eq('user_id', userId)
      .order('attempt_number', { ascending: false });

    return {
      quiz: { ...quiz, questions: assembledQuestions } as QuizTakingData,
      pastAttempts: (pastAttempts ?? []) as QuizAttempt[],
    };
  }

  async startQuizAttempt(quizId: string): Promise<QuizAttempt> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    // Check for existing unsubmitted attempt
    const { data: existing } = await this.#supabase.client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .is('submitted_at', null)
      .maybeSingle();

    if (existing) return existing as QuizAttempt;

    // Count total attempts
    const { count } = await this.#supabase.client
      .from('quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('user_id', userId);

    const attemptNumber = (count ?? 0) + 1;

    const { data, error } = await this.#supabase.client
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        quiz_id: quizId,
        attempt_number: attemptNumber,
      })
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to start quiz'));
    return data as QuizAttempt;
  }

  async submitQuizAttempt(attemptId: string, answers: QuizAnswerMap): Promise<QuizResults> {
    const client = this.#supabase.client;

    // 1. Batch insert answers
    const answerRows = Object.entries(answers).map(([questionId, userAnswer]) => ({
      attempt_id: attemptId,
      question_id: questionId,
      user_answer: userAnswer || null,
    }));

    if (answerRows.length > 0) {
      const { error: ansErr } = await client
        .from('quiz_attempt_answers')
        .insert(answerRows);
      if (ansErr) throw new Error(this.#extractErrorMessage(ansErr, 'Failed to save answers'));
    }

    // 2. Mark as submitted
    const { error: subErr } = await client
      .from('quiz_attempts')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', attemptId);
    if (subErr) throw new Error(this.#extractErrorMessage(subErr, 'Failed to submit quiz'));

    // 3. Grade via RPC
    const { data: gradeData, error: gradeErr } = await client
      .rpc('grade_quiz_attempt', { p_attempt_id: attemptId });
    if (gradeErr) throw new Error(this.#extractErrorMessage(gradeErr, 'Failed to grade quiz'));

    const grade = gradeData as QuizGradeResult;

    // 4. Get per-question results via RPC
    const { data: resultRows, error: resErr } = await client
      .rpc('get_quiz_results', { p_attempt_id: attemptId });
    if (resErr) throw new Error(this.#extractErrorMessage(resErr, 'Failed to load results'));

    const questions = (resultRows ?? []) as QuizQuestionResult[];

    // 5. Fetch updated attempt
    const { data: attempt } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('id', attemptId)
      .single();

    return { attempt: attempt as QuizAttempt, grade, questions };
  }

  async getQuizAttemptResults(attemptId: string): Promise<QuizResults> {
    const client = this.#supabase.client;

    // Fetch attempt
    const { data: attempt, error: aErr } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('id', attemptId)
      .single();
    if (aErr) throw new Error(this.#extractErrorMessage(aErr, 'Failed to load attempt'));

    // Get per-question results
    const { data: resultRows, error: resErr } = await client
      .rpc('get_quiz_results', { p_attempt_id: attemptId });
    if (resErr) throw new Error(this.#extractErrorMessage(resErr, 'Failed to load results'));

    const questions = (resultRows ?? []) as QuizQuestionResult[];
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const a = attempt as QuizAttempt;
    const grade: QuizGradeResult = {
      score: a.score ?? 0,
      passed: a.passed ?? false,
      earned_points: totalPoints > 0 ? Math.round(((a.score ?? 0) / 100) * totalPoints * 100) / 100 : 0,
      total_points: totalPoints,
    };

    return { attempt: a, grade, questions };
  }

  // --- Phase 5C: Exam Taking methods ---

  async loadExamForTaking(moduleId: string): Promise<{ exam: ExamTakingData; submission: ExamSubmission | null } | null> {
    const client = this.#supabase.client;
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return null;

    const { data: exam, error: examErr } = await client
      .from('exams')
      .select('id, title, description, duration_minutes, passing_score, max_file_size, allowed_file_types, exam_file_url')
      .eq('module_id', moduleId)
      .maybeSingle();

    if (examErr || !exam) return null;

    if (exam.exam_file_url) {
      exam.exam_file_url = await this.#getSignedUrl(exam.exam_file_url as string);
    }

    const { data: sub, error: subErr } = await client
      .from('exam_submissions')
      .select('id, exam_id, file_url, submitted_at, deadline, score, feedback, graded_by, graded_at')
      .eq('exam_id', exam.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) return null;

    let submission: ExamSubmission | null = null;
    if (sub) {
      const signedUrl = await this.#getSignedUrlFromBucket('exam-submissions', sub.file_url as string);
      submission = { ...sub, file_url: signedUrl ?? '' } as ExamSubmission;
    }

    return { exam: exam as ExamTakingData, submission };
  }

  async submitExamSubmission(
    examId: string,
    courseId: string,
    file: File,
    startedAt: string,
    durationMinutes: number,
  ): Promise<ExamSubmission> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = (this.#auth.currentUser() as { id: string; claims?: { tenant_id?: string } })
      ?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    const timestamp = Date.now();
    const storagePath = `${courseId}/${userId}/${timestamp}-${file.name}`;

    const { error: uploadErr } = await this.#supabase.client.storage
      .from('exam-submissions')
      .upload(storagePath, file);

    if (uploadErr) throw new Error(`Failed to upload submission: ${uploadErr.message}`);

    const deadline = new Date(new Date(startedAt).getTime() + durationMinutes * 60 * 1000).toISOString();

    const { data, error } = await this.#supabase.client
      .from('exam_submissions')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        exam_id: examId,
        course_id: courseId,
        file_url: storagePath,
        deadline,
      })
      .select('id, exam_id, file_url, submitted_at, deadline, score, feedback, graded_by, graded_at')
      .single();

    if (error) {
      await this.#supabase.client.storage.from('exam-submissions').remove([storagePath]);
      throw new Error(this.#extractErrorMessage(error, 'Failed to submit exam'));
    }

    const signedUrl = await this.#getSignedUrlFromBucket('exam-submissions', storagePath);
    return { ...data, file_url: signedUrl ?? '' } as ExamSubmission;
  }

  // --- Phase 3A: Course CRUD methods ---

  async createCourse(data: CourseFormData): Promise<{ id: string }> {
    const { data: result, error } = await this.#supabase.client
      .from('courses')
      .insert({
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url,
        enrollment_type: data.enrollment_type,
        password_hash: data.password_hash,
        staleness_threshold_days: data.staleness_threshold_days,
      })
      .select('id')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to create course'));
    return { id: result.id };
  }

  async updateCourse(id: string, data: Partial<CourseFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('courses')
      .update(data)
      .eq('id', id);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update course'));
  }

  async deleteCourse(id: string): Promise<void> {
    // Collect storage paths and Bunny video IDs BEFORE delete (CASCADE will remove DB rows)
    const [storagePaths, bunnyVideoIds] = await Promise.all([
      this.#listCourseStoragePaths(id),
      this.#collectCourseBunnyVideoIds(id),
    ]);

    const { error } = await this.#supabase.client
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete course'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async loadTenants(): Promise<TenantSummary[]> {
    const { data, error } = await this.#supabase.client
      .from('tenants')
      .select('id, name, domain, is_master')
      .order('name');

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load tenants'));
    return (data ?? []) as TenantSummary[];
  }

  async loadTenantAssignments(courseId: string): Promise<TenantAssignment[]> {
    const { data, error } = await this.#supabase.client
      .from('tenant_courses')
      .select('tenant_id, tenants(name)')
      .eq('course_id', courseId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load tenant assignments'));
    return (data ?? []).map((row) => ({
      tenant_id: row.tenant_id,
      tenant_name: (row.tenants as unknown as { name: string } | null)?.name ?? '',
    }));
  }

  async assignCourseToTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .insert({ course_id: courseId, tenant_id: tenantId });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to assign course to tenant'));
  }

  async removeCourseFromTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .delete()
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to remove course from tenant'));
  }

  // --- Phase 3B: Lecture CRUD methods ---

  async createLecture(courseId: string, data: LectureFormData): Promise<{ id: string }> {
    const detail = this.#courseDetail();
    const maxOrder = detail
      ? detail.lectures.reduce((max, l) => Math.max(max, l.sort_order), -1)
      : -1;

    const { data: result, error } = await this.#supabase.client
      .from('lectures')
      .insert({
        course_id: courseId,
        title: data.title,
        description: data.description,
        sort_order: maxOrder + 1,
      })
      .select('id')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to create lecture'));
    return { id: result.id };
  }

  async updateLecture(lectureId: string, data: Partial<LectureFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lectures')
      .update(data)
      .eq('id', lectureId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update lecture'));
  }

  async deleteLecture(lectureId: string): Promise<void> {
    // Collect storage paths and Bunny video IDs from ALL modules in this lecture before CASCADE
    const { data: modules } = await this.#supabase.client
      .from('modules')
      .select('id')
      .eq('lecture_id', lectureId);

    const storagePaths: string[] = [];
    const bunnyVideoIds: string[] = [];
    if (modules) {
      const results = await Promise.all(
        modules.map(async (m: { id: string }) => ({
          paths: await this.#collectModuleStoragePaths(m.id),
          videos: await this.#collectBunnyVideoIds(m.id),
        })),
      );
      for (const r of results) {
        storagePaths.push(...r.paths);
        bunnyVideoIds.push(...r.videos);
      }
    }

    const { error } = await this.#supabase.client
      .from('lectures')
      .delete()
      .eq('id', lectureId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete lecture'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async swapLectureSortOrder(idA: string, orderA: number, idB: string, orderB: number): Promise<void> {
    const resA = await this.#supabase.client
      .from('lectures')
      .update({ sort_order: orderB })
      .eq('id', idA);

    if (resA.error) throw new Error(this.#extractErrorMessage(resA.error, 'Failed to reorder lectures'));

    const resB = await this.#supabase.client
      .from('lectures')
      .update({ sort_order: orderA })
      .eq('id', idB);

    if (resB.error) throw new Error(this.#extractErrorMessage(resB.error, 'Failed to reorder lectures'));
  }

  // --- Phase 3C: Module CRUD methods ---

  async createModule(courseId: string, payload: ModuleSavePayload): Promise<{ id: string }> {
    const detail = this.#courseDetail();
    const lecture = detail?.lectures.find(l => l.id === payload.module.lecture_id);
    const maxOrder = lecture
      ? lecture.modules.reduce((max, m) => Math.max(max, m.sort_order), -1)
      : -1;

    const { data: result, error } = await this.#supabase.client
      .from('modules')
      .insert({
        course_id: courseId,
        lecture_id: payload.module.lecture_id,
        title: payload.module.title,
        description: payload.module.description,
        module_type: payload.module.module_type,
        sort_order: maxOrder + 1,
      })
      .select('id')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to create module'));

    try {
      await this.#insertModuleContent(result.id, payload.content);
    } catch (contentErr) {
      await this.#supabase.client.from('modules').delete().eq('id', result.id);
      throw contentErr;
    }

    return { id: result.id };
  }

  async updateModule(moduleId: string, payload: ModuleSavePayload): Promise<void> {
    const updateData: Record<string, unknown> = {
      title: payload.module.title,
      description: payload.module.description,
    };
    if (payload.significantUpdate) {
      updateData['significant_update_at'] = new Date().toISOString();
    }

    const { error } = await this.#supabase.client
      .from('modules')
      .update(updateData)
      .eq('id', moduleId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update module'));

    await this.#upsertModuleContent(moduleId, payload.content);
  }

  async deleteModule(moduleId: string): Promise<void> {
    // Collect storage paths and Bunny video IDs BEFORE delete (CASCADE will remove subtable rows)
    const [storagePaths, bunnyVideoIds] = await Promise.all([
      this.#collectModuleStoragePaths(moduleId),
      this.#collectBunnyVideoIds(moduleId),
    ]);

    const { error } = await this.#supabase.client
      .from('modules')
      .delete()
      .eq('id', moduleId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete module'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async swapModuleSortOrder(idA: string, orderA: number, idB: string, orderB: number): Promise<void> {
    const resA = await this.#supabase.client
      .from('modules')
      .update({ sort_order: orderB })
      .eq('id', idA);

    if (resA.error) throw new Error(this.#extractErrorMessage(resA.error, 'Failed to reorder modules'));

    const resB = await this.#supabase.client
      .from('modules')
      .update({ sort_order: orderA })
      .eq('id', idB);

    if (resB.error) throw new Error(this.#extractErrorMessage(resB.error, 'Failed to reorder modules'));
  }

  // --- Module files methods ---

  async loadModuleFiles(moduleId: string): Promise<ModuleFile[]> {
    const { data, error } = await this.#supabase.client
      .from('module_files')
      .select('id, file_url, file_name, file_size')
      .eq('module_id', moduleId)
      .order('file_name', { ascending: true });
    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load module files'));
    return (data ?? []) as ModuleFile[];
  }

  async addModuleFile(moduleId: string, file: { file_url: string; file_name: string; file_size: number | null }): Promise<void> {
    const { error } = await this.#supabase.client
      .from('module_files')
      .insert({ module_id: moduleId, ...file });
    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to add module file'));
  }

  async deleteModuleFile(fileId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('module_files')
      .delete()
      .eq('id', fileId);
    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete module file'));
  }

  async loadModuleForEdit(moduleId: string): Promise<{ module: ModuleDetail; content: ModuleContentFormData }> {
    const client = this.#supabase.client;

    const moduleRes = await client
      .from('modules')
      .select('id, title, description, module_type, sort_order, lecture_id, course_id')
      .eq('id', moduleId)
      .single();

    if (moduleRes.error) throw new Error(this.#extractErrorMessage(moduleRes.error, 'Failed to load module'));

    const mod = moduleRes.data as {
      id: string; title: string; description: string | null;
      module_type: string; sort_order: number; lecture_id: string; course_id: string;
    };

    const module: ModuleDetail = { ...mod, module_type: mod.module_type as ModuleType };
    const viewerContent = await this.#fetchModuleContent(client, moduleId, mod.module_type);
    const content = this.#contentToFormData(viewerContent);

    return { module, content };
  }

  async #insertModuleContent(moduleId: string, content: ModuleContentFormData): Promise<void> {
    switch (content.type) {
      case 'video': {
        if (!content.data) break;
        const { error } = await this.#supabase.client
          .from('module_videos')
          .insert({
            module_id: moduleId,
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to save video content'));
        break;
      }
      case 'pdf': {
        if (!content.data) break;
        const d = content.data as PdfFormData;
        const { error } = await this.#supabase.client
          .from('module_pdfs')
          .insert({ module_id: moduleId, file_url: d.file_url, file_name: d.file_name, page_count: d.page_count });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to save PDF content'));
        break;
      }
      case 'exam': {
        if (!content.data) break;
        const d = content.data as ExamFormData;
        const { error } = await this.#supabase.client
          .from('exams')
          .insert({
            module_id: moduleId,
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to save exam content'));
        break;
      }
      case 'markdown': {
        if (!content.data) break;
        const d = content.data as MarkdownFormData;
        const { error } = await this.#supabase.client
          .from('module_markdown')
          .insert({ module_id: moduleId, content: d.content });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to save markdown content'));
        break;
      }
      case 'quiz': {
        if (!content.data) break;
        const d = content.data as QuizFormData;
        const { data: quizRow, error: quizErr } = await this.#supabase.client
          .from('quizzes')
          .insert({
            module_id: moduleId,
            title: d.title, description: d.description,
            time_limit: d.time_limit, passing_score: d.passing_score,
            max_attempts: d.max_attempts, show_correct_answers: d.show_correct_answers,
            randomize_questions: d.randomize_questions, randomize_answers: d.randomize_answers,
          })
          .select('id').single();
        if (quizErr) throw new Error(this.#extractErrorMessage(quizErr, 'Failed to save quiz'));
        await this.#insertQuizQuestions(quizRow.id, d.questions);
        break;
      }
      case 'external_quiz': {
        if (!content.data) break;
        const d = content.data as ExternalQuizFormData;
        const { error } = await this.#supabase.client
          .from('external_quiz_references')
          .insert({
            module_id: moduleId,
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to save external quiz reference'));
        break;
      }
      default:
        break;
    }
  }

  async #upsertModuleContent(moduleId: string, content: ModuleContentFormData): Promise<void> {
    switch (content.type) {
      case 'video': {
        if (!content.data) break;
        const { error } = await this.#supabase.client
          .from('module_videos')
          .upsert({
            module_id: moduleId,
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update video content'));
        break;
      }
      case 'pdf': {
        if (!content.data) break;
        const d = content.data as PdfFormData;
        const { error } = await this.#supabase.client
          .from('module_pdfs')
          .upsert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            page_count: d.page_count,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update PDF content'));
        break;
      }
      case 'exam': {
        if (!content.data) break;
        const d = content.data as ExamFormData;
        const { error } = await this.#supabase.client
          .from('exams')
          .upsert({
            module_id: moduleId,
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update exam content'));
        break;
      }
      case 'markdown': {
        if (!content.data) break;
        const d = content.data as MarkdownFormData;
        const { error } = await this.#supabase.client
          .from('module_markdown')
          .upsert({ module_id: moduleId, content: d.content }, { onConflict: 'module_id' });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update markdown content'));
        break;
      }
      case 'quiz': {
        if (!content.data) break;
        const d = content.data as QuizFormData;
        const { data: quizRow, error: quizErr } = await this.#supabase.client
          .from('quizzes')
          .upsert({
            module_id: moduleId,
            title: d.title, description: d.description,
            time_limit: d.time_limit, passing_score: d.passing_score,
            max_attempts: d.max_attempts, show_correct_answers: d.show_correct_answers,
            randomize_questions: d.randomize_questions, randomize_answers: d.randomize_answers,
          }, { onConflict: 'module_id' })
          .select('id').single();
        if (quizErr) throw new Error(this.#extractErrorMessage(quizErr, 'Failed to update quiz'));
        // Delete existing questions (CASCADE deletes options)
        await this.#supabase.client.from('quiz_questions').delete().eq('quiz_id', quizRow.id);
        // Re-insert all questions + options
        await this.#insertQuizQuestions(quizRow.id, d.questions);
        break;
      }
      case 'external_quiz': {
        if (!content.data) break;
        const d = content.data as ExternalQuizFormData;
        const { error } = await this.#supabase.client
          .from('external_quiz_references')
          .upsert({
            module_id: moduleId,
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update external quiz reference'));
        break;
      }
      default:
        break;
    }
  }

  #contentToFormData(content: ModuleContent): ModuleContentFormData {
    switch (content.type) {
      case 'video':
        return {
          type: 'video',
          data: {
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          },
        };
      case 'pdf': {
        const d = content.data as ModulePdf;
        return {
          type: 'pdf',
          data: { file_url: d.file_url, file_name: d.file_name, page_count: d.page_count },
        };
      }
      case 'exam': {
        const d = content.data as ExamContent;
        return {
          type: 'exam',
          data: {
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          },
        };
      }
      case 'markdown': {
        const d = content.data as ModuleMarkdownContent;
        return {
          type: 'markdown',
          data: { content: d.content } as MarkdownFormData,
        };
      }
      case 'quiz': {
        if (!content.data) return { type: 'quiz', data: null };
        const q = content.data as QuizContent;
        return {
          type: 'quiz',
          data: {
            title: q.title,
            description: q.description,
            time_limit: q.time_limit,
            passing_score: q.passing_score,
            max_attempts: q.max_attempts,
            show_correct_answers: q.show_correct_answers,
            randomize_questions: q.randomize_questions,
            randomize_answers: q.randomize_answers,
            questions: q.questions.map(qn => ({
              question_text: qn.question_text,
              question_type: qn.question_type as QuizQuestionType,
              points: qn.points,
              sort_order: qn.sort_order,
              correct_answer: qn.correct_answer,
              options: qn.options.map(o => ({
                option_text: o.option_text,
                is_correct: o.is_correct,
                sort_order: o.sort_order,
              })),
            })),
          } as QuizFormData,
        };
      }
      case 'external_quiz': {
        const d = content.data as ExternalQuizContent;
        return {
          type: 'external_quiz',
          data: {
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          },
        };
      }
      default:
        return { type: (content as ModuleContent).type, data: null } as ModuleContentFormData;
    }
  }

  async #fetchModuleContent(client: SupabaseClient, moduleId: string, moduleType: string): Promise<ModuleContent> {
    switch (moduleType) {
      case 'video': {
        const res = await client.from('module_videos')
          .select('bunny_video_id, bunny_library_id, encoding_status, duration, thumbnail_url, original_filename')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        return { type: 'video', data: res.data as ModuleVideo };
      }
      case 'pdf': {
        const res = await client.from('module_pdfs').select('file_url, file_name, page_count').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { file_url: string; file_name: string; page_count: number | null };
        // file_url stores a storage path — resolve to a signed URL for viewing.
        // If the file was deleted from storage, set to empty string (viewer shows "File not found").
        const pdfSignedUrl = await this.#getSignedUrl(d.file_url);
        d.file_url = pdfSignedUrl ?? '';
        return { type: 'pdf', data: d };
      }
      case 'markdown': {
        const res = await client.from('module_markdown').select('content').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { content: string };
        return { type: 'markdown', data: d };
      }
      case 'exam': {
        const res = await client.from('exams')
          .select('title, description, duration_minutes, passing_score, max_file_size, allowed_file_types, exam_file_url')
          .eq('module_id', moduleId)
          .single();
        if (res.error) throw res.error;
        const d = res.data as ExamContent;
        // exam_file_url is optional — resolve to signed URL if present.
        // If the file was deleted from storage, clear it (exam renders without the file).
        if (d.exam_file_url) {
          d.exam_file_url = await this.#getSignedUrl(d.exam_file_url);
        }
        return { type: 'exam', data: d };
      }
      case 'quiz': {
        const quizRes = await client.from('quizzes')
          .select('id, title, description, time_limit, passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers')
          .eq('module_id', moduleId).maybeSingle();
        if (quizRes.error) throw quizRes.error;
        if (!quizRes.data) return { type: 'quiz', data: null };

        const questionsRes = await client.from('quiz_questions')
          .select('id, question_text, question_type, points, sort_order, correct_answer, quiz_question_options(id, option_text, is_correct, sort_order)')
          .eq('quiz_id', quizRes.data.id)
          .order('sort_order');
        if (questionsRes.error) throw questionsRes.error;

        return {
          type: 'quiz',
          data: {
            ...quizRes.data,
            questions: (questionsRes.data ?? []).map(q => ({
              ...q,
              question_type: q.question_type as QuizQuestionType,
              options: ((q as Record<string, unknown>)['quiz_question_options'] as { id: string; option_text: string; is_correct: boolean; sort_order: number }[] ?? [])
                .sort((a, b) => a.sort_order - b.sort_order),
            })),
          } as QuizContent,
        };
      }
      case 'external_quiz': {
        const res = await client.from('external_quiz_references')
          .select('external_quiz_id, external_quiz_url, passing_score')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        return { type: 'external_quiz', data: res.data as ExternalQuizContent };
      }
      default:
        return { type: moduleType as ModuleType, data: null } as ModuleContent;
    }
  }

  async #getSignedUrlFromBucket(bucket: string, storagePath: string): Promise<string | null> {
    const { data, error } = await this.#supabase.client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (error) {
      console.warn(`Signed URL failed for "${bucket}/${storagePath}": ${error.message}`);
      return null;
    }
    return data.signedUrl;
  }

  async #getSignedUrl(storagePath: string): Promise<string | null> {
    return this.#getSignedUrlFromBucket('course-files', storagePath);
  }

  #buildNavigation(moduleId: string): ModuleViewerData['navigation'] {
    const detail = this.#courseDetail();
    if (!detail) return { prev: null, next: null, current: 1, total: 1 };

    const flatModules: ModuleNavItem[] = [];
    for (const lecture of detail.lectures) {
      for (const mod of lecture.modules) {
        flatModules.push({
          id: mod.id,
          title: mod.title,
          module_type: mod.module_type,
          lectureTitle: lecture.title,
        });
      }
    }

    const idx = flatModules.findIndex(m => m.id === moduleId);
    return {
      prev: idx > 0 ? flatModules[idx - 1] : null,
      next: idx < flatModules.length - 1 ? flatModules[idx + 1] : null,
      current: idx + 1,
      total: flatModules.length,
    };
  }

  // --- Storage cleanup helpers (DI-07 fix) ---

  async #removeStorageFiles(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    try {
      const { error } = await this.#supabase.client.storage
        .from('course-files')
        .remove(paths);
      if (error) console.warn('Storage cleanup failed:', error.message);
    } catch (err) {
      console.warn('Storage cleanup error:', err);
    }
  }

  async #collectModuleStoragePaths(moduleId: string): Promise<string[]> {
    const client = this.#supabase.client;
    const paths: string[] = [];

    const [pdfRes, filesRes, examRes] = await Promise.all([
      client.from('module_pdfs').select('file_url').eq('module_id', moduleId).maybeSingle(),
      client.from('module_files').select('file_url').eq('module_id', moduleId),
      client.from('exams').select('exam_file_url').eq('module_id', moduleId).maybeSingle(),
    ]);

    if (pdfRes.data?.file_url) paths.push(pdfRes.data.file_url as string);
    if (filesRes.data) {
      for (const f of filesRes.data) {
        if ((f as { file_url: string }).file_url) paths.push((f as { file_url: string }).file_url);
      }
    }
    if (examRes.data?.exam_file_url) paths.push(examRes.data.exam_file_url as string);

    return paths;
  }

  async #collectBunnyVideoIds(moduleId: string): Promise<string[]> {
    const { data } = await this.#supabase.client
      .from('module_videos')
      .select('bunny_video_id')
      .eq('module_id', moduleId);
    if (!data) return [];
    return data
      .map((v: { bunny_video_id: string }) => v.bunny_video_id)
      .filter((id: string) => !!id);
  }

  #cleanupBunnyVideos(videoIds: string[]): void {
    for (const id of videoIds) {
      this.#bunnyUpload.deleteVideo(id).subscribe({
        error: () => console.warn('Bunny video cleanup failed for', id),
      });
    }
  }

  async #collectCourseBunnyVideoIds(courseId: string): Promise<string[]> {
    const { data } = await this.#supabase.client
      .from('module_videos')
      .select('bunny_video_id, modules!inner(course_id)')
      .eq('modules.course_id', courseId);
    if (!data) return [];
    return data
      .map((v: { bunny_video_id: string }) => v.bunny_video_id)
      .filter((id: string) => !!id);
  }

  async #listCourseStoragePaths(courseId: string): Promise<string[]> {
    const paths: string[] = [];
    let offset = 0;
    const limit = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await this.#supabase.client.storage
        .from('course-files')
        .list(courseId, { limit, offset });

      if (error || !data || data.length === 0) break;
      for (const file of data) {
        paths.push(`${courseId}/${file.name}`);
      }
      if (data.length < limit) break;
      offset += limit;
    }

    return paths;
  }

  async #insertQuizQuestions(quizId: string, questions: QuizQuestionFormData[]): Promise<void> {
    for (const q of questions) {
      const { data: qRow, error: qErr } = await this.#supabase.client
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: q.question_text,
          question_type: q.question_type,
          points: q.points,
          sort_order: q.sort_order,
          correct_answer: q.correct_answer,
        })
        .select('id').single();
      if (qErr) throw new Error(this.#extractErrorMessage(qErr, 'Failed to save question'));

      if (q.options.length > 0) {
        const { error: oErr } = await this.#supabase.client
          .from('quiz_question_options')
          .insert(q.options.map(o => ({
            question_id: qRow.id,
            option_text: o.option_text,
            is_correct: o.is_correct,
            sort_order: o.sort_order,
          })));
        if (oErr) throw new Error(this.#extractErrorMessage(oErr, 'Failed to save options'));
      }
    }
  }

  #extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
    return fallback;
  }
}
