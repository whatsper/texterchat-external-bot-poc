#!/bin/bash
root_dir=$(dirname $(realpath "$0"))

push=false
ci=false
print_tag_source="commit"

print_usage() {
  printf "Options:\n-p - Push image to registry \n-c - CI/CD Pipeline - Prints image full name with tag in last line \n-t [commit|version|branch] - Source for tag printed when -c flag specified. \"commit\" is default value \n"
}

set_tag_source() {
  case "${1}" in
    commit | branch | version) print_tag_source="${1}" ;;
    *) print_usage
       exit 1 ;;
  esac
}

while getopts 'pct:' flag; do
  case "${flag}" in
    p) push=true ;;
    c) ci=true ;;
    t) set_tag_source $OPTARG ;;
    *) print_usage
       exit 1 ;;
  esac
done

echo '===> Building docker image...'

VERSION=$(node -p "require('$root_dir/package.json').version")
MAJOR_VERSION=$(echo $VERSION | grep -P -o '^\d+')
GIT_BRANCH=$(git name-rev --name-only HEAD | sed "s/~.*//")
GIT_COMMIT=$(git rev-parse HEAD)
GIT_COMMIT_SHORT=$(echo $GIT_COMMIT | head -c 7)
GIT_TAG=$(git tag --points-at HEAD)
GIT_DIRTY='false'
BUILD_CREATOR=$(git config user.email)
# Whether the repo has uncommitted changes
if [[ $(git status -s) ]]; then
    GIT_DIRTY='true'
fi

sanitize_for_image_tag() {
  echo "$1" | sed "s/[^a-zA-Z0-9_]/_/g"
}

IMAGE_FULL_NAME="europe-docker.pkg.dev/texterchat-service/texterchat-external-bot-poc/texterchat-external-bot-poc"
BRANCH_TAG=$(sanitize_for_image_tag "$GIT_BRANCH")

cd $root_dir \
&& docker build \
  -t "$IMAGE_FULL_NAME":"$VERSION" \
  -t "$IMAGE_FULL_NAME":"latest" \
  -t "$IMAGE_FULL_NAME":"$BRANCH_TAG" \
  -t "$IMAGE_FULL_NAME":"$GIT_COMMIT_SHORT" \
  --build-arg GIT_BRANCH="$GIT_BRANCH" \
  --build-arg GIT_COMMIT="$GIT_COMMIT" \
  --build-arg GIT_TAG="$GIT_TAG" \
  --build-arg GIT_DIRTY="$GIT_DIRTY" \
  --build-arg BUILD_CREATOR="$BUILD_CREATOR" \
  --build-arg BUILD_NUMBER="$BUILD_NUMBER" \
  --build-arg VERSION="$VERSION" \
  $root_dir

build_status=$?

if [[ $build_status != 0 ]]; then
   echo "Docker build error"
   exit 1
fi

if [[ $push == true ]]; then
docker push "$IMAGE_FULL_NAME":"latest"
docker push "$IMAGE_FULL_NAME":"$VERSION"
docker push "$IMAGE_FULL_NAME":"$BRANCH_TAG"
docker push "$IMAGE_FULL_NAME":"$GIT_COMMIT_SHORT"
fi

if [[ $ci == true ]]; then
  case "${print_tag_source}" in
    commit)
      echo "$IMAGE_FULL_NAME":"$GIT_COMMIT_SHORT"
    ;;
    branch)
      echo "$IMAGE_FULL_NAME":"$BRANCH_TAG"
    ;;
    version)
      echo "$IMAGE_FULL_NAME":"$VERSION"
    ;;
    *) ;;
  esac
  exit 0
fi

echo "Done"