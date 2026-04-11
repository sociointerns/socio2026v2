import express from "express";
import {
  insert,
  queryAll,
  queryOne,
  update,
} from "../config/database.js";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
} from "../middleware/authMiddleware.js";
import {
  ROLE_CODES,
  hasAnyRoleCode,
  isServiceRoleCode,
  normalizeRoleCode,
} from "../utils/roleAccessService.js";

const router = express.Router();

const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};

const normalizeDecision = (decision) => String(decision || "").trim().toUpperCase();

const getUserRoleCodes = (req) => {
  return Array.isArray(req.userInfo?.role_codes) ? req.userInfo.role_codes : [];
};

const isMasterAdminRequest = (req) => {
  return Boolean(req.userInfo?.is_masteradmin) || hasAnyRoleCode(getUserRoleCodes(req), [ROLE_CODES.MASTER_ADMIN]);
};

const ensureQueueAccess = (req, res, roleCode) => {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (!normalizedRoleCode) {
    res.status(400).json({ error: "roleCode is required" });
    return false;
  }

  if (isMasterAdminRequest(req)) {
    return true;
  }

  if (!hasAnyRoleCode(getUserRoleCodes(req), [normalizedRoleCode])) {
    res.status(403).json({ error: "Access denied: role queue access not permitted" });
    return false;
  }

  return true;
};

const recomputeApprovalRequestStatus = async (approvalRequestId) => {
  const steps = await queryAll("approval_steps", {
    where: { approval_request_id: approvalRequestId },
    order: { column: "sequence_order", ascending: true },
  });

  const nowIso = new Date().toISOString();

  if (steps.some((step) => String(step.status || "").toUpperCase() === "REJECTED")) {
    await update(
      "approval_requests",
      { status: "REJECTED", decided_at: nowIso, updated_at: nowIso },
      { id: approvalRequestId }
    );
    return "REJECTED";
  }

  const allCompleted = steps.length > 0 && steps.every((step) => {
    const status = String(step.status || "").toUpperCase();
    return status === "APPROVED" || status === "SKIPPED";
  });

  if (allCompleted) {
    await update(
      "approval_requests",
      { status: "APPROVED", decided_at: nowIso, updated_at: nowIso },
      { id: approvalRequestId }
    );
    return "APPROVED";
  }

  await update(
    "approval_requests",
    { status: "UNDER_REVIEW", updated_at: nowIso },
    { id: approvalRequestId }
  );

  return "UNDER_REVIEW";
};

router.use(authenticateUser, getUserInfo(), checkRoleExpiration);

router.get("/me/roles", async (req, res) => {
  const roleCodes = getUserRoleCodes(req);

  return res.status(200).json({
    user: {
      email: req.userInfo?.email || null,
      is_masteradmin: Boolean(req.userInfo?.is_masteradmin),
      is_organiser: Boolean(req.userInfo?.is_organiser),
    },
    role_codes: roleCodes,
    role_assignments: Array.isArray(req.userInfo?.role_assignments) ? req.userInfo.role_assignments : [],
  });
});

router.get("/queues/:roleCode", async (req, res) => {
  try {
    const roleCode = normalizeRoleCode(req.params.roleCode);

    if (!ensureQueueAccess(req, res, roleCode)) {
      return;
    }

    const queueSteps = await queryAll("approval_steps", {
      where: { role_code: roleCode, status: "PENDING" },
      order: { column: "created_at", ascending: true },
    });

    const items = [];
    for (const step of queueSteps || []) {
      const approvalRequest = await queryOne("approval_requests", {
        where: { id: step.approval_request_id },
      });

      if (!approvalRequest) {
        continue;
      }

      items.push({
        request_id: approvalRequest.request_id,
        status: approvalRequest.status,
        entity_type: approvalRequest.entity_type,
        entity_ref: approvalRequest.entity_ref,
        organizing_dept: approvalRequest.organizing_dept,
        campus_hosted_at: approvalRequest.campus_hosted_at,
        step_code: step.step_code,
        step_group: step.step_group,
        sequence_order: step.sequence_order,
        created_at: step.created_at,
      });
    }

    return res.status(200).json({
      role_code: roleCode,
      pending_count: items.length,
      items,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error loading approval queue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-queues/:roleCode", async (req, res) => {
  try {
    const roleCode = normalizeRoleCode(req.params.roleCode);

    if (!isServiceRoleCode(roleCode)) {
      return res.status(400).json({ error: "Invalid service role code" });
    }

    if (!ensureQueueAccess(req, res, roleCode)) {
      return;
    }

    const serviceQueue = await queryAll("service_requests", {
      where: { service_role_code: roleCode, status: "PENDING" },
      order: { column: "created_at", ascending: true },
    });

    return res.status(200).json({
      role_code: roleCode,
      pending_count: (serviceQueue || []).length,
      items: serviceQueue || [],
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Service workflow schema is not available yet. Run latest migrations first.",
      });
    }

    console.error("Error loading service queue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/requests/:requestId/steps/:stepCode/decision", async (req, res) => {
  try {
    if (isMasterAdminRequest(req)) {
      return res.status(403).json({
        error: "Master admin can view and edit resources but cannot submit approval decisions.",
      });
    }

    const { requestId, stepCode } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    const approvalRequest = await queryOne("approval_requests", {
      where: { request_id: requestId },
    });

    if (!approvalRequest) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const approvalStep = await queryOne("approval_steps", {
      where: {
        approval_request_id: approvalRequest.id,
        step_code: stepCode,
      },
    });

    if (!approvalStep) {
      return res.status(404).json({ error: "Approval step not found" });
    }

    const stepStatus = String(approvalStep.status || "").toUpperCase();
    if (stepStatus !== "PENDING") {
      return res.status(409).json({
        error: "Approval step is not pending",
        current_status: approvalStep.status,
      });
    }

    const stepRoleCode = normalizeRoleCode(approvalStep.role_code);

    if (!ensureQueueAccess(req, res, stepRoleCode, approvalRequest)) {
      return;
    }

    const nowIso = new Date().toISOString();

    await update(
      "approval_steps",
      {
        status: decision,
        decided_at: nowIso,
        updated_at: nowIso,
      },
      { id: approvalStep.id }
    );

    await insert("approval_decisions", [{
      approval_request_id: approvalRequest.id,
      approval_step_id: approvalStep.id,
      decided_by_user_id: req.userInfo?.id || null,
      decided_by_email: req.userInfo?.email || null,
      role_code: stepRoleCode,
      decision,
      comment,
    }]);

    if (decision === "REJECTED") {
      await update(
        "approval_steps",
        { status: "SKIPPED", updated_at: nowIso },
        { approval_request_id: approvalRequest.id, status: "PENDING" }
      );
    }

    const requestStatus = await recomputeApprovalRequestStatus(approvalRequest.id);

    return res.status(200).json({
      message: "Decision recorded",
      request_id: requestId,
      step_code: stepCode,
      decision,
      request_status: requestStatus,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Approval workflow schema is not available yet. Run latest migrations first.",
      });
    }

    if (String(error?.code || "") === "23505") {
      return res.status(409).json({ error: "Decision already recorded by this user for this step" });
    }

    console.error("Error recording approval decision:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/service-requests/:serviceRequestId/decision", async (req, res) => {
  try {
    if (isMasterAdminRequest(req)) {
      return res.status(403).json({
        error: "Master admin can view and edit resources but cannot submit service decisions.",
      });
    }

    const { serviceRequestId } = req.params;
    const decision = normalizeDecision(req.body?.decision);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : null;

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
    }

    const serviceRequest = await queryOne("service_requests", {
      where: { service_request_id: serviceRequestId },
    });

    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const currentStatus = String(serviceRequest.status || "").toUpperCase();
    if (currentStatus !== "PENDING") {
      return res.status(409).json({
        error: "Service request is not pending",
        current_status: serviceRequest.status,
      });
    }

    const serviceRoleCode = normalizeRoleCode(serviceRequest.service_role_code);

    if (!isServiceRoleCode(serviceRoleCode)) {
      return res.status(400).json({ error: "Invalid service role on request" });
    }

    let approvalRequest = null;
    if (serviceRequest.approval_request_id) {
      approvalRequest = await queryOne("approval_requests", {
        where: { id: serviceRequest.approval_request_id },
      });
    }

    if (!ensureQueueAccess(req, res, serviceRoleCode, approvalRequest)) {
      return;
    }

    const nowIso = new Date().toISOString();

    await update(
      "service_requests",
      {
        status: decision,
        decided_at: nowIso,
        updated_at: nowIso,
      },
      { id: serviceRequest.id }
    );

    await insert("service_decisions", [{
      service_request_id: serviceRequest.id,
      decided_by_user_id: req.userInfo?.id || null,
      decided_by_email: req.userInfo?.email || null,
      role_code: serviceRoleCode,
      decision,
      comment,
    }]);

    return res.status(200).json({
      message: "Service decision recorded",
      service_request_id: serviceRequestId,
      role_code: serviceRoleCode,
      decision,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return res.status(503).json({
        error: "Service workflow schema is not available yet. Run latest migrations first.",
      });
    }

    if (String(error?.code || "") === "23505") {
      return res.status(409).json({ error: "Decision already recorded by this user for this service request" });
    }

    console.error("Error recording service decision:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
