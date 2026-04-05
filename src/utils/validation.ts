export type SignupFormValues = {
  account: string;
  password: string;
};

export type SignupFormErrors = {
  account?: string;
  password?: string;
};

export type RegisterFormValues = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

export type RegisterFormErrors = {
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateSignup(values: SignupFormValues): SignupFormErrors {
  const errors: SignupFormErrors = {};
  const account = values.account.trim();

  if (!account) {
    errors.account = "Vui lòng nhập tài khoản.";
  } else if (!/^[a-zA-Z0-9._-]{4,20}$/.test(account)) {
    errors.account = "Tài khoản 4-20 ký tự, chỉ gồm chữ, số, ., _, -.";
  }

  if (!values.password) {
    errors.password = "Vui lòng nhập mật khẩu.";
  } else if (values.password.length < 6) {
    errors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
  }

  return errors;
}

export function validateRegister(
  values: RegisterFormValues,
): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  const fullName = values.fullName.trim();
  const username = values.username.trim();
  const email = values.email.trim();

  if (!fullName) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  } else if (fullName.length < 2) {
    errors.fullName = "Họ và tên phải có ít nhất 2 ký tự.";
  }

  if (!username) {
    errors.username = "Vui lòng nhập tài khoản.";
  } else if (!/^[a-zA-Z0-9._-]{4,20}$/.test(username)) {
    errors.username = "Tài khoản 4-20 ký tự, chỉ gồm chữ, số, ., _, -.";
  }

  if (!email) {
    errors.email = "Vui lòng nhập email.";
  } else if (!isValidEmail(email)) {
    errors.email = "Email không đúng định dạng.";
  }

  if (!values.password) {
    errors.password = "Vui lòng nhập mật khẩu.";
  } else if (values.password.length < 8) {
    errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
  }

  return errors;
}
