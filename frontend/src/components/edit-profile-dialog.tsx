import { useEffect, useRef, useState } from "react";
import { Modal } from "react-aria-components";
import { motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Camera,
  Github,
  Globe,
  IdCard,
  Linkedin,
  Lock,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  User,
  X,
} from "lucide-react";

import { api } from "../lib/api";
import { useAuth, type CurrentUser, type PresenceStatus } from "../store/auth";
import { Button } from "./ui/button";
import { FormField, IconInput } from "./ui/form-field";
import { Backdrop } from "./tailgrids/core/overlay";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./tailgrids/core/dialog";
import { PRESENCE_OPTIONS, UserAvatar, useAuthenticatedImage } from "./ui/avatar";
import { Textarea } from "./ui/input";
import { cn } from "../lib/utils";

const optionalUrl = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine(
    (value) => {
      if (!value || !value.trim()) return true;
      try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid URL (https://…)" },
  );

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  employee_id: z.string().optional().or(z.literal("")),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().or(z.literal("")),
  designation: z.string().optional().or(z.literal("")),
  status_presence: z.enum([
    "available",
    "busy",
    "do_not_disturb",
    "be_right_back",
    "away",
    "offline",
  ]),
  status_message: z.string().max(280).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  website_url: optionalUrl,
  password: z.string().min(8, "At least 8 characters").optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

function toFormValues(user: CurrentUser): ProfileForm {
  return {
    name: user.name,
    employee_id: user.employee_id ?? "",
    email: user.email,
    phone: user.phone ?? "",
    designation: user.designation ?? "",
    status_presence: (user.status_presence ?? "available") as PresenceStatus,
    status_message: user.status_message ?? "",
    bio: user.bio ?? "",
    linkedin_url: user.linkedin_url ?? "",
    github_url: user.github_url ?? "",
    website_url: user.website_url ?? "",
    password: "",
  };
}

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, setUser, avatarVersion, bumpAvatarVersion } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [hasAvatar, setHasAvatar] = useState(Boolean(user?.has_avatar));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarSrc = useAuthenticatedImage(
    open && hasAvatar && !previewFileUrl,
    "/auth/me/avatar",
    avatarVersion,
  );
  const displayAvatar = previewFileUrl ?? avatarSrc;

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: user ? toFormValues(user) : undefined,
  });

  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      form.reset(toFormValues(user));
      setHasAvatar(Boolean(user.has_avatar));
      setPreviewFileUrl(null);
      try {
        const me = await api.get<CurrentUser>("/auth/me");
        if (cancelled) return;
        form.reset(toFormValues(me));
        setHasAvatar(Boolean(me.has_avatar));
        setUser(me);
      } catch {
        // Fall back to cached session user.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (previewFileUrl) URL.revokeObjectURL(previewFileUrl);
    };
  }, [previewFileUrl]);

  async function handleAvatarPick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreviewFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localUrl;
    });
    setHasAvatar(true);
    setUploadingAvatar(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const updated = await api.putForm<CurrentUser>("/auth/me/avatar", body);
      setUser(updated);
      setHasAvatar(Boolean(updated.has_avatar));
      bumpAvatarVersion();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload photo");
      setHasAvatar(Boolean(user?.has_avatar));
    } finally {
      setUploadingAvatar(false);
      setPreviewFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const updated = await api.delete<CurrentUser>("/auth/me/avatar");
      setUser(updated);
      setHasAvatar(false);
      bumpAvatarVersion();
      setPreviewFileUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSubmit(values: ProfileForm) {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: values.name.trim(),
        email: values.email.trim(),
        employee_id: values.employee_id?.trim() ?? "",
        phone: values.phone?.trim() ?? "",
        designation: values.designation?.trim() ?? "",
        status_presence: values.status_presence,
        status_message: values.status_message?.trim() ?? "",
        bio: values.bio?.trim() ?? "",
        linkedin_url: values.linkedin_url?.trim() ?? "",
        github_url: values.github_url?.trim() ?? "",
        website_url: values.website_url?.trim() ?? "",
      };
      if (values.password?.trim()) {
        payload.password = values.password.trim();
      }
      const updated = await api.put<CurrentUser>("/auth/me", payload);
      setUser(updated);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (saving || uploadingAvatar) return;
    onOpenChange(false);
    form.reset();
    setPreviewFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  return (
    <Backdrop
      isOpen={open}
      isDismissable={!saving && !uploadingAvatar}
      onOpenChange={(next) => (!next ? close() : onOpenChange(true))}
    >
      <Modal className="outline-none">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed inset-y-0 right-0 z-50 flex h-full w-[min(100vw,40rem)] flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <div className="shrink-0 border-b border-primary/10 bg-primary-light px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
                  <Pencil className="h-5 w-5 text-white" />
                </div>
                <DialogHeader className="gap-0.5">
                  <DialogTitle id="edit-profile-title" className="text-lg font-semibold text-gray-900">
                    Edit profile
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    Photo, status, links, and account details.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={saving || uploadingAvatar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/70 hover:text-gray-800 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading profile…</p>
              ) : (
                <div className="flex flex-col gap-6">
                  <section className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-5 py-5">
                    <div className="relative">
                      <UserAvatar
                        name={form.watch("name") || user?.name || "User"}
                        size="lg"
                        src={displayAvatar}
                        presence={form.watch("status_presence")}
                        showPresence
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
                        aria-label="Change photo"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.target.value = "";
                        void handleAvatarPick(file);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingAvatar ? "Uploading…" : "Upload photo"}
                      </Button>
                      {hasAvatar ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingAvatar}
                          onClick={() => void handleRemoveAvatar()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-center text-[11px] text-gray-500">JPEG, PNG, WebP or GIF · max 5MB</p>
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </p>
                    <Controller
                      control={form.control}
                      name="status_presence"
                      render={({ field }) => (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {PRESENCE_OPTIONS.map((option) => {
                            const selected = field.value === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => field.onChange(option.value)}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                                  selected
                                    ? "border-primary bg-primary-light text-primary"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                                )}
                              >
                                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dotClass)} />
                                <span className="font-medium leading-tight">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    <FormField
                      label="Status message"
                      error={form.formState.errors.status_message?.message}
                      icon={MessageSquare}
                    >
                      <Controller
                        control={form.control}
                        name="status_message"
                        render={({ field }) => (
                          <IconInput
                            placeholder="e.g. In a meeting until 3pm"
                            maxLength={280}
                            {...field}
                          />
                        )}
                      />
                    </FormField>
                  </section>

                  <section className="space-y-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      About you
                    </p>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <FormField label="Name" error={form.formState.errors.name?.message} icon={User}>
                        <Controller
                          control={form.control}
                          name="name"
                          render={({ field }) => <IconInput placeholder="Full name" {...field} />}
                        />
                      </FormField>
                      <FormField
                        label="Employee ID"
                        error={form.formState.errors.employee_id?.message}
                        icon={IdCard}
                      >
                        <Controller
                          control={form.control}
                          name="employee_id"
                          render={({ field }) => <IconInput placeholder="Employee ID" {...field} />}
                        />
                      </FormField>
                      <FormField label="Email" error={form.formState.errors.email?.message} icon={Mail}>
                        <Controller
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <IconInput type="email" placeholder="name@company.com" {...field} />
                          )}
                        />
                      </FormField>
                      <FormField label="Phone" error={form.formState.errors.phone?.message} icon={Phone}>
                        <Controller
                          control={form.control}
                          name="phone"
                          render={({ field }) => <IconInput placeholder="Phone number" {...field} />}
                        />
                      </FormField>
                      <FormField
                        label="Designation"
                        error={form.formState.errors.designation?.message}
                        icon={User}
                        className="sm:col-span-2"
                      >
                        <Controller
                          control={form.control}
                          name="designation"
                          render={({ field }) => <IconInput placeholder="Designation" {...field} />}
                        />
                      </FormField>
                      <FormField label="Bio" error={form.formState.errors.bio?.message} className="sm:col-span-2">
                        <Controller
                          control={form.control}
                          name="bio"
                          render={({ field }) => (
                            <Textarea
                              rows={3}
                              placeholder="A short intro about your role and focus areas"
                              maxLength={500}
                              className="w-full resize-none"
                              {...field}
                            />
                          )}
                        />
                      </FormField>
                    </div>
                  </section>

                  <section className="space-y-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Links
                    </p>
                    <div className="grid gap-3.5">
                      <FormField
                        label="LinkedIn"
                        error={form.formState.errors.linkedin_url?.message}
                        icon={Linkedin}
                      >
                        <Controller
                          control={form.control}
                          name="linkedin_url"
                          render={({ field }) => (
                            <IconInput placeholder="https://linkedin.com/in/…" {...field} />
                          )}
                        />
                      </FormField>
                      <FormField
                        label="GitHub"
                        error={form.formState.errors.github_url?.message}
                        icon={Github}
                      >
                        <Controller
                          control={form.control}
                          name="github_url"
                          render={({ field }) => (
                            <IconInput placeholder="https://github.com/…" {...field} />
                          )}
                        />
                      </FormField>
                      <FormField
                        label="Website"
                        error={form.formState.errors.website_url?.message}
                        icon={Globe}
                      >
                        <Controller
                          control={form.control}
                          name="website_url"
                          render={({ field }) => (
                            <IconInput placeholder="https://…" {...field} />
                          )}
                        />
                      </FormField>
                    </div>
                  </section>

                  <section className="space-y-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Security
                    </p>
                    <FormField
                      label="New password"
                      error={form.formState.errors.password?.message}
                      icon={Lock}
                    >
                      <Controller
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <IconInput
                            type="password"
                            autoComplete="new-password"
                            placeholder="Leave blank to keep"
                            {...field}
                          />
                        )}
                      />
                    </FormField>
                    {user?.role ? (
                      <p className="text-xs text-gray-500">
                        Role:{" "}
                        <span className="font-medium text-gray-700">
                          {user.role.replace(/_/g, " ")}
                        </span>
                        {" · "}managed by admin
                      </p>
                    ) : null}
                  </section>
                </div>
              )}
            </DialogBody>
            <DialogFooter className="shrink-0 border-t border-gray-100 px-6 py-4 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={close}
                disabled={saving || uploadingAvatar}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || loading || uploadingAvatar}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </motion.div>
      </Modal>
    </Backdrop>
  );
}
