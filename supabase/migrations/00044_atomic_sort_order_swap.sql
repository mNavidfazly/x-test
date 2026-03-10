-- Atomic sort_order swap for lectures and modules
-- Prevents duplicate sort_order values caused by non-atomic two-request swaps

CREATE OR REPLACE FUNCTION swap_lecture_sort_order(p_id_a uuid, p_id_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_order_a integer;
  v_order_b integer;
BEGIN
  IF p_id_a = p_id_b THEN
    RAISE EXCEPTION 'Cannot swap a lecture with itself';
  END IF;

  -- Lock rows in deterministic UUID order to prevent deadlocks
  IF p_id_a < p_id_b THEN
    SELECT sort_order INTO v_order_a FROM lectures WHERE id = p_id_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lecture % not found', p_id_a; END IF;
    SELECT sort_order INTO v_order_b FROM lectures WHERE id = p_id_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lecture % not found', p_id_b; END IF;
  ELSE
    SELECT sort_order INTO v_order_b FROM lectures WHERE id = p_id_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lecture % not found', p_id_b; END IF;
    SELECT sort_order INTO v_order_a FROM lectures WHERE id = p_id_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lecture % not found', p_id_a; END IF;
  END IF;

  IF v_order_a = v_order_b THEN
    RAISE EXCEPTION 'Lectures have the same sort_order (%), cannot swap', v_order_a;
  END IF;

  UPDATE lectures SET sort_order = v_order_b WHERE id = p_id_a;
  UPDATE lectures SET sort_order = v_order_a WHERE id = p_id_b;
END;
$$;

CREATE OR REPLACE FUNCTION swap_module_sort_order(p_id_a uuid, p_id_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_order_a integer;
  v_order_b integer;
BEGIN
  IF p_id_a = p_id_b THEN
    RAISE EXCEPTION 'Cannot swap a module with itself';
  END IF;

  -- Lock rows in deterministic UUID order to prevent deadlocks
  IF p_id_a < p_id_b THEN
    SELECT sort_order INTO v_order_a FROM modules WHERE id = p_id_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Module % not found', p_id_a; END IF;
    SELECT sort_order INTO v_order_b FROM modules WHERE id = p_id_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Module % not found', p_id_b; END IF;
  ELSE
    SELECT sort_order INTO v_order_b FROM modules WHERE id = p_id_b FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Module % not found', p_id_b; END IF;
    SELECT sort_order INTO v_order_a FROM modules WHERE id = p_id_a FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Module % not found', p_id_a; END IF;
  END IF;

  IF v_order_a = v_order_b THEN
    RAISE EXCEPTION 'Modules have the same sort_order (%), cannot swap', v_order_a;
  END IF;

  UPDATE modules SET sort_order = v_order_b WHERE id = p_id_a;
  UPDATE modules SET sort_order = v_order_a WHERE id = p_id_b;
END;
$$;
