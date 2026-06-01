function initProfilePage({
  onBack,
  onSaved,
  getCurrentAccount,
}) {
  const profileScreen = document.getElementById('profile-screen');
  const profileTitle = document.getElementById('profile-page-title');
  const profileAvatar = document.getElementById('profile-page-avatar');
  const profileAccount = document.getElementById('profile-page-account');
  const profileDisplayName = document.getElementById('profile-page-display-name');
  const profileBio = document.getElementById('profile-page-bio');
  const profileHomepage = document.getElementById('profile-page-homepage');
  const profileHomepageLink = document.getElementById('profile-page-homepage-link');
  const profileMeta = document.getElementById('profile-page-meta');
  const profileError = document.getElementById('profile-page-error');
  const profileSaveBtn = document.getElementById('profile-page-save');
  const profileEditSection = document.getElementById('profile-edit-section');
  const profileViewSection = document.getElementById('profile-view-section');
  const profileAvatarOptions = document.getElementById('profile-page-avatar-options');
  const profileAvatarUpload = document.getElementById('profile-page-avatar-upload');

  let viewingAccount = null;
  let isOwnProfile = false;
  let pageSelectedAvatar = null;

  function showError(msg) {
    profileError.textContent = msg;
    profileError.classList.remove('hidden');
  }

  function hideError() {
    profileError.classList.add('hidden');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async function loadProfile(account) {
    hideError();
    viewingAccount = account;
    isOwnProfile = account === getCurrentAccount();

    const user = isOwnProfile
      ? getStoredUser()
      : await fetchPublicProfile(account);

      profileTitle.textContent = isOwnProfile ? '我的主页' : `${user.displayName} 的主页`;
      setAvatarPreview(profileAvatar, user.avatar);
      profileAccount.textContent = `@${user.account}`;
      profileMeta.textContent = `加入于 ${formatDate(user.createdAt)}`;

      profileEditSection.classList.toggle('hidden', !isOwnProfile);
      profileViewSection.classList.toggle('hidden', isOwnProfile);
      profileSaveBtn.classList.toggle('hidden', !isOwnProfile);

      if (isOwnProfile) {
        profileDisplayName.value = user.displayName;
        profileBio.value = user.bio || '';
        profileHomepage.value = user.homepage || '';
        pageSelectedAvatar = user.avatar;
        buildAvatarPicker(profileAvatarOptions, (emoji) => {
          pageSelectedAvatar = emoji;
          setAvatarPreview(profileAvatar, emoji);
          profileAvatarUpload.value = '';
        }, typeof user.avatar === 'string' && !user.avatar.startsWith('data:') ? user.avatar : null);
      } else {
        document.getElementById('profile-view-display-name').textContent = user.displayName;
        document.getElementById('profile-view-bio').textContent = user.bio || '暂无简介';
        const noHomepage = document.getElementById('profile-view-no-homepage');
        if (user.homepage) {
          profileHomepageLink.href = user.homepage;
          profileHomepageLink.textContent = user.homepage;
          profileHomepageLink.classList.remove('hidden');
          noHomepage.classList.add('hidden');
        } else {
          profileHomepageLink.classList.add('hidden');
          noHomepage.classList.remove('hidden');
        }
      }

    profileScreen.classList.remove('hidden');
  }

  profileAvatarUpload.addEventListener('change', () => {
    const file = profileAvatarUpload.files[0];
    readAvatarFile(
      file,
      (dataUrl) => {
        pageSelectedAvatar = dataUrl;
        setAvatarPreview(profileAvatar, dataUrl);
        profileAvatarOptions.querySelectorAll('.avatar-option').forEach((b) => {
          b.classList.remove('is-selected');
        });
        hideError();
      },
      (msg) => showError(msg)
    );
  });

  profileSaveBtn.addEventListener('click', async () => {
    hideError();
    try {
      const user = await updateProfile({
        displayName: profileDisplayName.value.trim(),
        avatar: pageSelectedAvatar,
        bio: profileBio.value.trim(),
        homepage: profileHomepage.value.trim(),
      });
      onSaved(user);
      profileTitle.textContent = '我的主页';
      hideError();
    } catch (err) {
      showError(err.message);
    }
  });

  document.getElementById('profile-back-btn').addEventListener('click', () => {
    profileScreen.classList.add('hidden');
    onBack();
  });

  return {
    open(account) {
      loadProfile(account).catch((err) => {
        showError(err.message);
      });
    },
    hide() {
      profileScreen.classList.add('hidden');
    },
    refreshOwn(user) {
      if (isOwnProfile && viewingAccount === user.account) {
        setAvatarPreview(profileAvatar, user.avatar);
        profileDisplayName.value = user.displayName;
        profileBio.value = user.bio || '';
        profileHomepage.value = user.homepage || '';
        pageSelectedAvatar = user.avatar;
      }
    },
  };
}
